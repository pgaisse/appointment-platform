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

  // ✅ NUEVO: Agrupar moves por appointmentId+slotId (cada slot es independiente)
  const appointmentMoves = new Map();
  
  for (const m of rawMoves) {
    const id = String(m?.id || '').trim();
    if (!OID_RE.test(id)) continue;

    const position = Number.isFinite(m?.position) ? Number(m.position) : undefined;
    const priority = m?.priority && OID_RE.test(String(m.priority)) ? String(m.priority) : undefined;
    const slotId = m?.slotId && OID_RE.test(String(m.slotId)) ? String(m.slotId) : undefined;

    if (position === undefined && !priority) continue;

    // ✅ Clave única: appointmentId|slotId para mantener slots independientes
    const key = slotId ? `${id}|${slotId}` : id;

    if (!appointmentMoves.has(key)) {
      appointmentMoves.set(key, { id, position, priority, slotId });
    } else {
      const existing = appointmentMoves.get(key);
      if (position !== undefined) existing.position = position;
      if (priority) existing.priority = priority;
      if (slotId) existing.slotId = slotId;
    }
  }

  const moves = [...appointmentMoves.values()];
  if (!moves.length) {
    return res.status(400).json({ error: 'No hay movimientos válidos' });
  }

  const session = await mongoose.startSession();
  const results = [];

  try {
    await session.withTransaction(async () => {
      for (const m of moves) {
        const filter = org_id != null
          ? {
              _id: new mongoose.Types.ObjectId(m.id),
              $or: [{ org_id: { $exists: false } }, { org_id }],
            }
          : { _id: new mongoose.Types.ObjectId(m.id) };

        // ✅ Obtener el appointment actual
        const appointment = await Appointment.findOne(filter).session(session);

        if (!appointment) {
          results.push({
            status: 'failed',
            id: m.id,
            reason: 'Documento no encontrado o fuera de la organización',
          });
          continue;
        }

        // ✅ ESTRATEGIA: Si viene slotId, actualizar ESE slot específico
        // Si NO viene slotId, es un movimiento legacy (actualizar root.priority/position)
        
        if (m.slotId) {
          // NUEVO SISTEMA: Actualizar slot específico
          const slotIndex = appointment.selectedAppDates.findIndex(
            slot => slot._id.toString() === m.slotId
          );

          if (slotIndex === -1) {
            results.push({
              status: 'failed',
              id: m.id,
              reason: `Slot ${m.slotId} no encontrado en appointment`,
            });
            continue;
          }

          // ✅ Actualizar priority del slot si viene
          if (m.priority) {
            appointment.selectedAppDates[slotIndex].priority = new mongoose.Types.ObjectId(m.priority);
          }

          // ✅ Actualizar position del SLOT específico (no del root)
          if (m.position !== undefined) {
            appointment.selectedAppDates[slotIndex].position = m.position;
          }

          appointment.unknown = false;
          if (org_id != null) appointment.org_id = org_id;

          await appointment.save({ session });

          results.push({ 
            status: 'success', 
            id: m.id,
            slotId: m.slotId,
            updatedSlot: true 
          });

        } else {
          // LEGACY SYSTEM: Actualizar root.priority y root.position (deprecado)
          const set = { unknown: false };
          if (m.position !== undefined) set.position = m.position;
          if (m.priority) set.priority = new mongoose.Types.ObjectId(m.priority);
          if (org_id != null) set.org_id = org_id;

          const updated = await Appointment.findOneAndUpdate(
            filter,
            { $set: set },
            { new: true, session }
          );

          if (!updated) {
            results.push({
              status: 'failed',
              id: m.id,
              reason: 'Error al actualizar documento',
            });
          } else {
            results.push({ 
              status: 'success', 
              id: m.id,
              updatedRoot: true 
            });
          }
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
      
      // ✅ NUEVA ESTRATEGIA: Crear un card por cada priority única en slots
      const appointments = await models.Appointment.aggregate([
        {
          $match: {
            org_id: org_id,
            // Excluir position == -1
            $expr: {
              $ne: [
                { $convert: { input: "$position", to: "double", onError: null, onNull: null } },
                -1
              ]
            },
            // ✅ MODIFICADO: Debe tener al menos un slot en el rango de fechas O con status Complete/Confirmed
            selectedAppDates: {
              $elemMatch: {
                $or: [
                  // Slots en el rango de fechas
                  {
                    startDate: { $lte: end },
                    endDate: { $gte: start },
                  },
                  // O slots con status Complete/Confirmed (mostrar siempre)
                  {
                    status: { $in: ['Complete', 'Confirmed'] }
                  }
                ]
              },
            },
          },
        },

        // UNWIND slots para procesar cada uno individualmente
        { $unwind: { path: "$selectedAppDates", preserveNullAndEmptyArrays: false } },

        // Filtrar slots: incluir TODOS los que están en el rango, sin importar su status
        // ADEMÁS incluir Complete/Confirmed SIEMPRE (aunque estén fuera del rango)
        {
          $match: {
            $or: [
              // Slots en el rango de fechas (CUALQUIER status)
              {
                "selectedAppDates.startDate": { $lte: end },
                "selectedAppDates.endDate": { $gte: start },
              },
              // O slots con status Complete/Confirmed (mostrar siempre, fuera de rango)
              {
                "selectedAppDates.status": { $in: ['Complete', 'Confirmed'] }
              }
            ]
          },
        },

        // POPULATE slot treatment
        {
          $lookup: {
            from: 'treatments',
            localField: 'selectedAppDates.treatment',
            foreignField: '_id',
            as: 'selectedAppDates.treatment',
          },
        },
        {
          $unwind: {
            path: '$selectedAppDates.treatment',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE slot priority
        {
          $lookup: {
            from: 'PriorityList',
            localField: 'selectedAppDates.priority',
            foreignField: '_id',
            as: 'selectedAppDates.priority',
          },
        },
        {
          $unwind: {
            path: '$selectedAppDates.priority',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE slot providers
        {
          $lookup: {
            from: 'providers',
            localField: 'selectedAppDates.providers',
            foreignField: '_id',
            as: 'selectedAppDates.providers',
          },
        },

        // ✅ POPULATE root priority (para appointments con priority solo a nivel raíz)
        {
          $lookup: {
            from: 'PriorityList',
            localField: 'priority',
            foreignField: '_id',
            as: 'rootPriorityDoc',
          },
        },
        {
          $unwind: {
            path: '$rootPriorityDoc',
            preserveNullAndEmptyArrays: true,
          },
        },

        // POPULATE representative.appointment
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

        // POPULATE messagelogs
        {
          $lookup: {
            from: 'messagelogs',
            localField: '_id',
            foreignField: 'appointment',
            as: 'contactMessages',
          },
        },

        // POPULATE selectedDates.days.timeBlocks
        { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'timeblocks',
            localField: 'selectedDates.days.timeBlocks',
            foreignField: '_id',
            as: 'selectedDates.days.timeBlocks',
          },
        },

        // GROUP para reconstruir selectedDates.days pero MANTENER el slot individual
        {
          $group: {
            _id: { appointmentId: "$_id", slotId: "$selectedAppDates._id" },
            contactPreference: { $first: "$contactPreference" },
            sid: { $first: "$sid" },
            nameInput: { $first: "$nameInput" },
            emailInput: { $first: "$emailInput" },
            emailLower: { $first: "$emailLower" },
            phoneInput: { $first: "$phoneInput" },
            phoneE164: { $first: "$phoneE164" },
            lastNameInput: { $first: "$lastNameInput" },
            textAreaInput: { $first: "$textAreaInput" },
            representative: { $first: "$representative" },
            note: { $first: "$note" },
            color: { $first: "$color" },
            user_id: { $first: "$user_id" },
            org_id: { $first: "$org_id" },
            contactMessages: { $first: "$contactMessages" },
            position: { $first: "$position" },
            reschedule: { $first: "$reschedule" },
            // ✅ Guardar priority a nivel raíz como fallback (populated)
            rootPriority: { $first: "$rootPriorityDoc" },
            selectedStartDate: { $first: "$selectedDates.startDate" },
            selectedEndDate: { $first: "$selectedDates.endDate" },
            days: { $push: "$selectedDates.days" },
            // ⬇️ SOLO el slot actual con todo populated
            slot: { $first: "$selectedAppDates" },
          },
        },

        // Rebuild selectedDates y aplanar _id
        {
          $addFields: {
            _id: "$_id.appointmentId",
            selectedDates: {
              startDate: "$selectedStartDate",
              endDate: "$selectedEndDate",
              days: "$days",
            },
            // Crear array de 1 slot para compatibilidad
            selectedAppDates: ["$slot"],
            // ✅ Mantener rootPriority disponible para fallback
            priority: "$rootPriority",
          },
        },

        // Limpiar campos temporales
        {
          $project: {
            selectedStartDate: 0,
            selectedEndDate: 0,
            slot: 0,
            repDoc: 0,
            rootPriority: 0,
          },
        },
      ]);

      // ✅ PASO 1: Obtener TODAS las prioridades de la organización
      const allPriorities = await models.PriorityList.find({ org_id }).sort({ id: 1 });
      console.log("allPriorities", allPriorities);
      // ✅ PASO 2: Inicializar grouped con TODAS las prioridades (vacías inicialmente)
      const grouped = new Map();
      
      for (const priority of allPriorities) {
        grouped.set(priority._id.toString(), {
          _id: priority._id,
          priorityNum: priority.id,
          priorityId: priority._id,
          priorityName: priority.name,
          priorityColor: priority.color,
          description: priority.description,
          durationHours: priority.durationHours,
          priority: {
            org_id: priority.org_id,
            id: priority.id,
            _id: priority._id,
            description: priority.description,
            notes: priority.notes || '',
            durationHours: priority.durationHours,
            name: priority.name,
            color: priority.color,
          },
          patients: [],
        });
      }

      // ✅ PASO 3: Agregar appointments a sus respectivas prioridades
      for (const appt of appointments) {
        const slot = appt.selectedAppDates?.[0];
        
        // ✅ FALLBACK: Usar priority del slot, o si no existe, la del root appointment (ya populated)
        let priorityId;
        let priorityDoc;
        
        if (slot?.priority?._id) {
          // Priority a nivel de slot (ya populated)
          priorityId = slot.priority._id.toString();
          priorityDoc = slot.priority;
        } else if (appt.priority?._id) {
          // Priority a nivel raíz (ya populated desde rootPriorityDoc)
          priorityId = appt.priority._id.toString();
          priorityDoc = appt.priority;
          
          // ✅ CRÍTICO: Copiar la priority del root al slot para que el frontend la vea
          if (slot) {
            slot.priority = priorityDoc;
          }
        }

        // Silenciosamente ignorar slots sin priority (esperado para appointments sin categorizar)
        if (!priorityId) {
          console.log(`ℹ️ [/DraggableCards] Appointment ${appt._id} (${appt.nameInput}) ignorado: sin priority asignada`);
          continue;
        }

        // Si la priority existe en el Map, agregar el appointment
        if (grouped.has(priorityId)) {
          grouped.get(priorityId).patients.push(appt);
        } else {
          console.warn(`⚠️ Appointment ${appt._id} tiene priority ${priorityId} que no existe en PriorityList`);
        }
      }

      // Convertir Map a Array y agregar count
      const result = Array.from(grouped.values()).map(col => {
        // ✅ Ordenar patients por slot.position
        const sortedPatients = col.patients.sort((a, b) => {
          const posA = a.selectedAppDates?.[0]?.position ?? 0;
          const posB = b.selectedAppDates?.[0]?.position ?? 0;
          return posA - posB;
        });
        
        return {
          ...col,
          patients: sortedPatients,
          count: sortedPatients.length,
        };
      });

      console.log(`✅ [/DraggableCards] Procesados ${appointments.length} appointment-slots`);
      console.log(`✅ [/DraggableCards] Agrupados en ${result.length} columnas de prioridad`);
      result.forEach(col => {
        console.log(`   📋 ${col.priorityName} (${col.priorityColor}): ${col.count} patients`);
      });
      console.log("Result", result);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[GET /DraggableCards] Error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);



module.exports = router;
