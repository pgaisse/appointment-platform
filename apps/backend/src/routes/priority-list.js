// apps/backend/src/routes/priority-list.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { jwtCheck } = require('../middleware/auth');
const helpers = require('../helpers');
const { Appointment } = require('../models/Appointments');

const OID_RE = /^[a-fA-F0-9]{24}$/;

router.patch('/priority-list/move', jwtCheck, async (req, res) => {
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

module.exports = router;
