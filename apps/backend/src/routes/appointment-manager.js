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
  { path: 'priority', select: 'id description notes durationHours name color' },
  { path: 'treatment', select: '_id name notes duration icon color minIcon' },
  { path: 'providers' },
  {
    path: 'representative.appointment',
    select: 'phoneInput phoneE164 emailLower nameInput lastNameInput sid proxyAddress', // pon aquí lo que necesites
    // model: 'Appointment', // opcional, Mongoose lo infiere porque el ref es a Appointment
  },
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

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 200);
    const sort = req.query.sort ? JSON.parse(req.query.sort) : { updatedAt: -1 };

    let extra = {};
    if (req.query.filter) { try { extra = JSON.parse(req.query.filter); } catch { } }

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

  const exact = String(req.query.exact || 'false') === 'true';
  const suggest = String(req.query.suggest || 'false') === 'true';

    let items = [];
  if (exact) {
      // Exact match mode: phone/email/name/id equality (case-insensitive where applies)
      const { toE164AU } = require('../models/Appointments');

      const $or = [];

      // 1) Phone exact (normalize to E.164 AU)
      try {
        const e164 = toE164AU(q);
        if (e164) $or.push({ phoneE164: e164 });
      } catch { /* not a valid AU phone */ }

      // 2) Email exact (lowercased)
      if (q.includes('@')) {
        $or.push({ emailLower: q.toLowerCase() });
      }

      // 3) ObjectId by id
      if (/^[a-f\d]{24}$/i.test(q)) {
        try { $or.push({ _id: new mongoose.Types.ObjectId(q) }); } catch { /* ignore */ }
      }

      // 4) Name exact (case-insensitive equality)
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const first = words[0];
        const last = words.slice(1).join(' ');
        $or.push({
          $and: [
            { nameInput: { $regex: `^${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
            { lastNameInput: { $regex: `^${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          ],
        });
      } else if (words.length === 1) {
        const token = words[0];
        const anchored = `^${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        $or.push({ nameInput: { $regex: anchored, $options: 'i' } });
        $or.push({ lastNameInput: { $regex: anchored, $options: 'i' } });
      }

      // Fallback: if nothing matched a category, don't return fuzzy results
      if ($or.length === 0) {
        return res.json({ items: [], total: 0 });
      }

      items = await Appointment.find({ ...filter, $or })
        .populate(populateFields)
        .limit(limit)
        .collation({ locale: 'en', strength: 2 });
    } else if (suggest) {
      // Suggestion mode: prefix-anchored, case-insensitive on name/lastName/phone
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchored = `^${esc(q)}`;

      // phoneE164 prefix candidate from partial input
      const phoneOrNull = (() => {
        const raw = q.replace(/\s+/g, '');
        if (/^\+61\d{0,9}$/.test(raw)) return raw; // already e164 prefix
        if (/^0\d{1,9}$/.test(raw)) return `+61${raw.slice(1)}`; // convert 0xxxx -> +61xxxx
        return null;
      })();

      const $or = [
        { nameInput: { $regex: anchored, $options: 'i' } },
        { lastNameInput: { $regex: anchored, $options: 'i' } },
        { phoneInput: { $regex: anchored } }, // phoneInput often starts with 0
      ];
      if (phoneOrNull) $or.push({ phoneE164: { $regex: `^${esc(phoneOrNull)}` } });

      items = await Appointment.find({ ...filter, $or })
        .populate(populateFields)
        .limit(limit)
        .collation({ locale: 'en', strength: 2 });
    } else {
      // Original fuzzy search: text index then regex fallback
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
