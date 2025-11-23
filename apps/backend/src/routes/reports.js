// apps/backend/src/routes/reports.js
const express = require('express');
const router = express.Router();
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { syncUserFromToken } = require('../middleware/sync-user');
const helpers = require('../helpers');
const { Appointment, Treatment, PriorityList, ManualContact } = require('../models/Appointments');
const Provider = require('../models/Provider/Provider');
const { attachSignedUrlsToPopulated } = require('../helpers/user.helpers');

// Protected routes middleware chain (consistent with other protected routes)
router.use(jwtCheck, attachUserInfo, ensureUser, syncUserFromToken);

// Map resource -> model + searchable fields
const RESOURCE_MAP = {
  appointments: {
    model: Appointment,
    // Do not include 'user' ref in regex fields to avoid type errors on ObjectId
    fields: ['nameInput', 'lastNameInput', 'phoneInput', 'emailInput', 'sid'],
    projection: { nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, sid: 1, org_id: 1, createdAt: 1, color: 1, treatment: 1, priority: 1, user: 1, selectedAppDates: 1 },
    populate: [
      { path: 'treatment', select: 'name duration color icon' },
      { path: 'priority', select: 'name color id' },
      { path: 'user', select: 'name email picture' }
    ]
  },
  providers: {
    model: Provider,
    fields: ['firstName', 'lastName', 'email', 'phone', 'ahpraNumber'],
    projection: { firstName: 1, lastName: 1, email: 1, phone: 1, ahpraNumber: 1, org_id: 1, isActive: 1, createdAt: 1, user: 1 },
    populate: [ { path: 'user', select: 'name email picture' } ]
  },
  contacts: {
    // Contacts are lightweight appointments without scheduling/treatment data
    // Definition (per user clarification): appointments lacking selectedAppDates, treatment and selectedDates
    // We will derive them from the Appointment model instead of ManualContact.
    model: Appointment,
    fields: ['nameInput', 'lastNameInput', 'phoneInput', 'emailInput', 'sid'],
    projection: { nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, sid: 1, org_id: 1, createdAt: 1, color: 1, user: 1 },
    populate: [ { path: 'user', select: 'name email picture' } ]
  },
  treatments: {
    model: Treatment,
    fields: ['name', 'category', 'icon'],
    projection: { name: 1, category: 1, duration: 1, color: 1, icon: 1, active: 1, org_id: 1, createdAt: 1 },
    populate: []
  },
  priorities: {
    model: PriorityList,
    fields: ['name', 'description', 'notes'],
    projection: { name: 1, description: 1, notes: 1, durationHours: 1, color: 1, id: 1, org_id: 1, createdAt: 1 },
    populate: []
  }
};

function buildAdvancedSearchFilter(search, fields) {
  if (!search) return {};
  const raw = String(search).trim();
  if (!raw) return {};
  // Split by whitespace, ignore empty tokens
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (!tokens.length) return {};
  const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // For a single token keep legacy behaviour (slightly faster index use)
  if (tokens.length === 1) {
    const tok = tokens[0];
    // Date token support even when single
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) {
      d = new Date(tok + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tok)) {
      const [dd, mm, yyyy] = tok.split('/');
      d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    if (d && !isNaN(d.getTime())) {
      const next = new Date(d.getTime() + 24*60*60*1000);
      return { createdAt: { $gte: d, $lt: next } };
    }
    const rx = new RegExp(escape(tok), 'i');
    return { $or: fields.map(f => ({ [f]: rx })) };
  }
  // Multiple tokens -> AND of token groups; each token may match any field
  const andGroups = tokens.map(tok => ({ $or: fields.map(f => ({ [f]: new RegExp(escape(tok), 'i') })) }));
  const dateClauses = [];
  for (const tok of tokens) {
    // Basic date token support (YYYY-MM-DD or DD/MM/YYYY)
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) {
      d = new Date(tok + 'T00:00:00');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tok)) {
      const [dd, mm, yyyy] = tok.split('/');
      d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    if (d && !isNaN(d.getTime())) {
      const next = new Date(d.getTime() + 24*60*60*1000);
      dateClauses.push({ createdAt: { $gte: d, $lt: next } });
    }
  }
  if (dateClauses.length) andGroups.push(...dateClauses);
  return { $and: andGroups };
}

router.get('/:resource', async (req, res) => {
  try {
    const { resource } = req.params;
    const meta = RESOURCE_MAP[resource];
    if (!meta) return res.status(400).json({ error: 'INVALID_RESOURCE', message: `Unsupported resource: ${resource}` });

    const tokenInfo = await helpers.getTokenInfo(req.headers.authorization).catch(() => null);
    const org_id = tokenInfo?.org_id;
    if (!org_id) return res.status(400).json({ error: 'ORG_REQUIRED' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
    const sortFieldRaw = String(req.query.sort || '').trim();
    const dirRaw = String(req.query.dir || 'asc').toLowerCase();
    const search = req.query.search || '';

    const model = meta.model;
    const baseFilter = { org_id };
    const searchFilter = buildAdvancedSearchFilter(search, meta.fields);
    let filter = Object.keys(searchFilter).length ? { ...baseFilter, ...searchFilter } : baseFilter;

    // Additional constraints for derived contacts: appointments that behave like bare contacts
    if (resource === 'contacts') {
      // Combine search with structural constraints using $and to avoid $or key collisions
      const structural = [
        { $or: [ { treatment: null }, { treatment: { $exists: false } } ] },
        { $or: [ { 'selectedAppDates.0': { $exists: false } }, { selectedAppDates: { $size: 0 } } ] },
        { $or: [ { 'selectedDates.startDate': { $exists: false } }, { 'selectedDates.startDate': null } ] },
      ];
      const clauses = [ baseFilter ];
      if (Object.keys(searchFilter).length) clauses.push(searchFilter);
      clauses.push(...structural);
      filter = { $and: clauses };
    }

    // Filter out providers without basic information (firstName or lastName must exist)
    if (resource === 'providers') {
      const providerClauses = [ baseFilter ];
      if (Object.keys(searchFilter).length) providerClauses.push(searchFilter);
      // At least one of firstName, lastName, or email must be present
      providerClauses.push({
        $or: [
          { firstName: { $exists: true, $ne: null, $ne: '' } },
          { lastName: { $exists: true, $ne: null, $ne: '' } },
          { email: { $exists: true, $ne: null, $ne: '' } }
        ]
      });
      filter = { $and: providerClauses };
    }

    const skip = (page - 1) * limit;
    let sort = { createdAt: -1 }; // default
    const allowedSortFields = [...meta.fields, 'createdAt'];
    if (sortFieldRaw && allowedSortFields.includes(sortFieldRaw)) {
      const dirVal = dirRaw === 'desc' ? -1 : 1;
      sort = { [sortFieldRaw]: dirVal, _id: dirVal }; // tie-breaker by _id
    }
    let query = model.find(filter, meta.projection).sort(sort).skip(skip).limit(limit);
    for (const p of meta.populate) query = query.populate(p);
    const [items, total] = await Promise.all([
      query.lean(),
      model.countDocuments(filter)
    ]);

    // Generate signed URLs for user pictures in populated items
    const itemsWithSignedUrls = await attachSignedUrlsToPopulated(items);

    return res.json({
      data: itemsWithSignedUrls,
      meta: {
        resource,
        page,
        limit,
        total,
        hasMore: skip + items.length < total,
        search: search || null,
        sort: sortFieldRaw && allowedSortFields.includes(sortFieldRaw) ? { field: sortFieldRaw, dir: dirRaw === 'desc' ? 'desc' : 'asc' } : { field: 'createdAt', dir: 'desc' }
      }
    });
  } catch (err) {
    console.error('[GET /reports/:resource] error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

module.exports = router;
