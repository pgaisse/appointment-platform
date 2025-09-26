// apps/backend/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Appointment } = require('../models/Appointments');

// 🔎 logger de ENTRADA AL ROUTER (si no lo ves, el router no está montado)
router.use((req, _res, next) => {
  console.log(`[appointments] ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ ping SIN auth (debe responder SIEMPRE si el router está montado)
router.get('/_debug/ping', (req, res) => {
  console.log('[appointments] _debug/ping OK');
  res.json({ ok: true, ts: Date.now() });
});

// ⚠️ deja pasar OPTIONS (preflight) para que CORS no tropiece con auth
router.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ───────────────── auth y adjuntos ─────────────────
const { jwtCheck, attachUserInfo, ensureUser } = require("../middleware/auth");
// Si quieres **obligar** auth para TODO el router:
router.use(jwtCheck, attachUserInfo, ensureUser);

const NS = process.env.AUTH0_NAMESPACE || 'https://letsmarter.com/';

const populateFields = [
  { path: 'priority',  select: 'id description notes durationHours name color' },
  { path: 'treatment', select: '_id name notes duration icon color minIcon' },
  { path: 'selectedDates.days.timeBlocks' },
];

function getOrgId(req) {
  const claims = (req.auth && req.auth.payload) || {};
  return claims[NS + 'org_id'] || claims.org_id || req.user?.org_id || null;
}

// Lista paginada
router.get('/', async (req, res, next) => {
  try {
    console.log('[appointments] GET / hit');
    const org_id = req.user?.org_id || getOrgId(req);
    console.log('[appointments] org_id =', org_id);

    if (!org_id) return res.status(400).json({ error: 'Missing org_id' });

    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const sort  = req.query.sort ? JSON.parse(req.query.sort) : { updatedAt: -1 };

    let extra = {};
    if (req.query.filter) { try { extra = JSON.parse(req.query.filter); } catch {} }

    const filter = { org_id, ...extra };
    console.log('[appointments] filter =', filter);

    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .populate(populateFields)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Appointment.countDocuments(filter),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (err) {
    next(err);
  }
});

// Búsqueda
router.get('/search', async (req, res, next) => {
  try {
    console.log('[appointments] GET /search hit');
    const org_id = req.user?.org_id || getOrgId(req);
    console.log('[appointments] org_id =', org_id);

    if (!org_id) return res.status(400).json({ error: 'Missing org_id' });

    const q = (req.query.q || '').trim();
    if (!q) return res.json({ items: [], total: 0 });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10), 1), 500);
    const filter = { org_id };

    let items = [];
    try {
      items = await Appointment.find({ ...filter, $text: { $search: q } })
        .populate(populateFields)
        .limit(limit);
    } catch {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      items = await Appointment.find({
        ...filter,
        $or: [{ nameInput: rx }, { lastNameInput: rx }, { phoneInput: rx }, { note: rx }],
      })
        .populate(populateFields)
        .limit(limit);
    }

    res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

// ⛑️ logger de errores LOCAL al router (verás auth/errors aquí)
router.use((err, _req, res, _next) => {
  console.error('[appointments] ERROR:', err);
  res.status(err.status || 500).json({ error: err.message, code: err.code || 'internal' });
});

module.exports = router;
