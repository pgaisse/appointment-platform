// apps/backend/src/routes/priority-list.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const helpers = require('../helpers');
const { Appointment } = require('../models/Appointments');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, ensureUser } = require('../middleware/auth');
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');
router.use(jwtCheck, attachUserInfo, ensureUser);
const OID_RE = /^[a-fA-F0-9]{24}$/;
const models = require("../models/Appointments");

router.patch('/priority-list/move', jwtCheck, requireAnyPermissionExplain('appointment_cards:move', 'dev-admin'), async (req, res) => {
  const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

  // Acepta: array directo o { moves: [] }
  const rawMoves = Array.isArray(req.body)
    ? req.body
    : (Array.isArray(req.body?.moves) ? req.body.moves : []);
  if (!rawMoves.length) {
    return res.status(400).json({ error: 'Body debe ser un array de moves o { moves: [] }' });
  }

  // Sanitize + dedupe (última escritura por id gana)
  const map = new Map();
  for (const m of rawMoves) {
    const id = String(m?.id || '').trim();
    if (!OID_RE.test(id)) continue;

    const position =
      Number.isFinite(m?.position) ? Number(m.position) : undefined;
    const priority =
      m?.priority && OID_RE.test(String(m.priority)) ? String(m.priority) : undefined;

    if (position === undefined && !priority) continue;

    const prev = map.get(id) || { id };
    if (position !== undefined) prev.position = position;
    if (priority) prev.priority = priority;
    map.set(id, prev);
  }
  const moves = [...map.values()];
  if (!moves.length) {
    return res.status(400).json({ error: 'No hay movimientos válidos' });
  }

  const session = await mongoose.startSession();
  const results = [];

  try {
    await session.withTransaction(async () => {
      for (const m of moves) {
        const set = { unknown: false };
        if (m.position !== undefined) set.position = m.position;
        if (m.priority) set.priority = new mongoose.Types.ObjectId(m.priority);
        if (org_id != null) set.org_id = org_id;

        // ✅ Filtro por tenant SIN proxyAddress
        const filter = org_id != null
          ? {
              _id: new mongoose.Types.ObjectId(m.id),
              $or: [{ org_id: { $exists: false } }, { org_id }],
            }
          : { _id: new mongoose.Types.ObjectId(m.id) };

        const updated = await Appointment.findOneAndUpdate(
          filter,
          { $set: set },
          { new: true, session }
        );

        if (!updated) {
          results.push({
            status: 'failed',
            id: m.id,
            reason: 'Documento no encontrado o fuera de la organización',
          });
        } else {
          results.push({ status: 'success', id: m.id });
        }
      }
    });

    const allOK = results.every(r => r.status === 'success');
    return res.status(allOK ? 200 : 207).json({
      message: allOK ? 'All moves applied' : 'Some moves failed',
      results,
    });
  } catch (err) {
    console.error('❌ Critical error in /priority-list/move:', err.stack || err);
    return res.status(500).json({
      error: 'Critical failure while processing priority-list moves',
      details: err.message,
    });
  } finally {
    session.endSession();
  }
});

router.get(
  '/DraggableCards',
  jwtCheck,
  requireAnyPermissionExplain('appointment_cards:read', 'dev-admin'),
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
      }

      const { org_id, token } = await helpers.getTokenInfo(authHeader);
      console.log("Token", token);
      if (!org_id) {
        return res.status(403).json({ error: 'Unauthorized: org_id not found' });
      }

      const { start, end } = helpers.getDateRange();
      if (!start || !end) {
        return res.status(400).json({ error: 'Invalid date range' });
      }

      const result = await models.PriorityList.aggregate([
        { $match: { org_id } },
        {
          $lookup: {
            from: 'appointments',
            let: {
              durationHours: '$durationHours',
              priorityNum: '$id',
              priorityId: '$_id',
              priorityName: '$name',
              priorityColor: '$color',
              priorityDescription: '$description',
              priorityNotes: '$notes'
            },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$priority', '$$priorityId'] },
                  org_id: org_id,
                  selectedAppDates: {
                    $elemMatch: {
                      // Solapamiento: la cita debe empezar antes del fin del rango Y terminar después del inicio
                      startDate: { $lte: end },
                      endDate: { $gte: start },
                    },
                  },
                },
              },
              // ⬇️ Excluir SOLO position == -1 (acepta nulos/ausentes y strings)
              {
                $match: {
                  $expr: {
                    $ne: [
                      { $convert: { input: "$position", to: "double", onError: null, onNull: null } },
                      -1
                    ]
                  }
                }
              },

              { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: 'timeblocks',
                  localField: 'selectedDates.days.timeBlocks',
                  foreignField: '_id',
                  as: 'selectedDates.days.timeBlocks',
                },
              },
              {
                $lookup: {
                  from: 'messagelogs',
                  localField: '_id',
                  foreignField: 'appointment',
                  as: 'contactMessages',
                },
              },

              // 👇 AGRUPAMOS y CONSERVAMOS representative
              {
                $group: {
                  _id: "$_id",
                  contactPreference: { $first: "$contactPreference" },
                  sid: { $first: "$sid" },
                  nameInput: { $first: "$nameInput" },
                  emailInput: { $first: "$emailInput" },
                  emailLower: { $first: "$emailLower" },   // opcional por si lo necesitas
                  phoneInput: { $first: "$phoneInput" },
                  phoneE164: { $first: "$phoneE164" },     // opcional por si lo necesitas
                  lastNameInput: { $first: "$lastNameInput" },
                  textAreaInput: { $first: "$textAreaInput" },
                  representative: { $first: "$representative" }, // ⬅️ mantener subdoc
                  priority: { $first: "$priority" },
                  note: { $first: "$note" },
                  color: { $first: "$color" },
                  user_id: { $first: "$user_id" },
                  org_id: { $first: "$org_id" },
                  treatment: { $first: "$treatment" },
                  contactMessages: { $first: "$contactMessages" },
                  position: { $first: "$position" },
                  reschedule: { $first: "$reschedule" },
                  selectedStartDate: { $first: "$selectedDates.startDate" },
                  selectedEndDate: { $first: "$selectedDates.endDate" },
                  days: { $push: "$selectedDates.days" },
                  selectedAppDates: { $first: "$selectedAppDates" },
                },
              },

              // 👇 POPULATE manual del representative.appointment
              {
                $lookup: {
                  from: 'appointments',
                  let: { repId: '$representative.appointment' },
                  pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$repId'] } } },
                    {
                      $project: {
                        _id: 1,
                        phoneInput: 1,
                        phoneE164: 1,
                        emailLower: 1,
                        nameInput: 1,
                        lastNameInput: 1,
                        sid: 1,
                        proxyAddress: 1
                      }
                    }
                  ],
                  as: 'repDoc'
                }
              },
              { $unwind: { path: '$repDoc', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  'representative.appointment': '$repDoc'
                }
              },
              { $project: { repDoc: 0 } },

              // Tratamiento
              {
                $lookup: {
                  from: 'treatments',
                  localField: 'treatment',
                  foreignField: '_id',
                  as: 'treatment',
                },
              },
              {
                $unwind: {
                  path: '$treatment',
                  preserveNullAndEmptyArrays: true,
                },
              },

              // Campos calculados
              {
                $addFields: {
                  selectedDates: {
                    startDate: "$selectedStartDate",
                    endDate: "$selectedEndDate",
                    days: "$days",
                  },
                  priority: {
                    durationHours: "$$durationHours",
                    description: "$$priorityDescription",
                    notes: "$$priorityNotes",
                    id: "$$priorityNum",
                    _id: "$$priorityId",
                    name: "$$priorityName",
                    color: "$$priorityColor",
                  }
                },
              },
              {
                $project: {
                  selectedStartDate: 0,
                  selectedEndDate: 0
                },
              },
            ],
            as: 'patients',
          },
        },
        {
          $project: {
            _id: 1,
            priorityNum: "$id",
            priorityId: "$_id",
            priorityName: "$name",
            priorityColor: "$color",
            description: 1,
            durationHours: 1,
            priority: {
              org_id: "$org_id",
              id: "$id",
              _id: "$_id",
              description: "$description",
              notes: "$notes",
              durationHours: "$durationHours",
              name: "$name",
              color: "$color"
            },
            count: { $size: "$patients" },
            patients: 1,
          },
        },
      ]);

      return res.status(200).json(result);
    } catch (err) {
      console.error('[GET /DraggableCards] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);



module.exports = router;
