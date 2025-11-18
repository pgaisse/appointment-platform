// apps/backend/src/routes/tokens.js
// Endpoints for token registry, lint and render

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const mongoose = require('mongoose');

const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');
const helpers = require('../helpers');
const { TemplateToken, Appointment } = require('../models/Appointments');
const { applyTemplateTokensBackend, extractColonTokens } = require('../helpers/tokenRenderer');
const liquid = require('../helpers/liquidEngine');
const { unifiedRender, unifiedLint } = require('../helpers/unifiedRenderer');

// Auth for all routes in this file
router.use(jwtCheck, attachUserInfo, ensureUser);

const keyRx = /^:[A-Za-z][A-Za-z0-9_]*$/;

const tokenBody = z.object({
  key: z.string().regex(keyRx),
  label: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  field: z.string().min(1).max(120).nullable().optional(),
  secondLevelField: z.string().min(1).max(120).nullable().optional(),
  type: z.enum(['string', 'date', 'time', 'phone', 'custom']).default('string'),
});

// GET /api/tokens/registry → list tokens for org
router.get('/registry', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    let items = await TemplateToken.find({ $or: [{ org_id }, { org_id: { $exists: false } }] }).sort({ key: 1 }).lean();

    // Inject synthetic slot tokens if not present in registry (read-only, not persisted)
    const existingKeys = new Set(items.map(it => it.key));
    const syntheticToAdd = [];
    if (!existingKeys.has(':SelectedSlotDate')) {
      syntheticToAdd.push({
        _id: 'ffffffffffffffffffffffff', // synthetic stable id (valid ObjectId format)
        key: ':SelectedSlotDate',
        label: 'Selected Slot Date',
        description: 'Fecha (inicio) del slot seleccionado en formato ccc, dd LLL yyyy',
        field: null,
        secondLevelField: null,
        type: 'date',
        synthetic: true,
      });
    }
    if (!existingKeys.has(':SelectedSlotRange')) {
      syntheticToAdd.push({
        _id: 'eeeeeeeeeeeeeeeeeeeeeeee',
        key: ':SelectedSlotRange',
        label: 'Selected Slot Range',
        description: 'Rango completo del slot seleccionado (fecha(s) + horas)',
        field: null,
        secondLevelField: null,
        type: 'string',
        synthetic: true,
      });
    }
    // Calendar slot synthetic tokens (from calendar selection in PatientFinder)
    if (!existingKeys.has(':CalendarSlotDate')) {
      syntheticToAdd.push({
        _id: 'dddddddddddddddddddddddd',
        key: ':CalendarSlotDate',
        label: 'Calendar Slot Date',
        description: 'Fecha inicial del rango seleccionado en el calendario (ccc, dd LLL yyyy)',
        field: null,
        secondLevelField: null,
        type: 'date',
        synthetic: true,
      });
    }
    if (!existingKeys.has(':CalendarSlotRange')) {
      syntheticToAdd.push({
        _id: 'cccccccccccccccccccccccc',
        key: ':CalendarSlotRange',
        label: 'Calendar Slot Range',
        description: 'Rango completo seleccionado en el calendario (fecha(s) + horas)',
        field: null,
        secondLevelField: null,
        type: 'string',
        synthetic: true,
      });
    }
    if (!existingKeys.has(':CalendarSlotStartTime')) {
      syntheticToAdd.push({
        _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        key: ':CalendarSlotStartTime',
        label: 'Calendar Slot Start Time',
        description: 'Hora de inicio del rango seleccionado en el calendario (HH:mm)',
        field: null,
        secondLevelField: null,
        type: 'time',
        synthetic: true,
      });
    }
    if (!existingKeys.has(':CalendarSlotEndTime')) {
      syntheticToAdd.push({
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        key: ':CalendarSlotEndTime',
        label: 'Calendar Slot End Time',
        description: 'Hora de fin del rango seleccionado en el calendario (HH:mm)',
        field: null,
        secondLevelField: null,
        type: 'time',
        synthetic: true,
      });
    }
    if (syntheticToAdd.length) {
      // Keep natural order then append synthetics at end
      items = items.concat(syntheticToAdd);
    }
    res.json({ items });
  } catch (err) {
    console.error('[GET /tokens/registry] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tokens → create
router.post('/', requireAnyPermissionExplain('tokens:write', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const data = tokenBody.parse(req.body);
    const { org_id, sub } = await helpers.getTokenInfo(req.headers.authorization);
    const doc = await TemplateToken.create({ ...data, org_id, createdBy: sub });
    res.status(201).json({ ok: true, document: doc });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(422).json({ error: 'validation_failed', issues: err.issues });
    if (err?.code === 11000) return res.status(409).json({ error: 'duplicate_key', detail: err.keyValue });
    console.error('[POST /tokens] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PATCH /api/tokens/:id → update
router.patch('/:id', requireAnyPermissionExplain('tokens:write', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'bad_id' });
    const data = tokenBody.partial().parse(req.body);
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    const doc = await TemplateToken.findOneAndUpdate(
      { _id: id, $or: [{ org_id }, { org_id: { $exists: false } }] },
      { $set: data },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, document: doc });
  } catch (err) {
    if (err?.name === 'ZodError') return res.status(422).json({ error: 'validation_failed', issues: err.issues });
    console.error('[PATCH /tokens/:id] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/tokens/:id → delete
router.delete('/:id', requireAnyPermissionExplain('tokens:write', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'bad_id' });
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    const r = await TemplateToken.deleteOne({ _id: id, $or: [{ org_id }, { org_id: { $exists: false } }] });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error('[DELETE /tokens/:id] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tokens/lint → detect unknown tokens by colon syntax
router.post('/lint', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { content } = req.body || {};
    const used = extractColonTokens(String(content ?? ''));
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    const registry = await TemplateToken.find({ $or: [{ org_id }, { org_id: { $exists: false } }] }).select('key').lean();
    const valid = new Set(registry.map((t) => t.key));
    const unknown = used.filter((k) => !valid.has(k));
    res.json({ ok: true, used, unknown, valid: [...valid] });
  } catch (err) {
    console.error('[POST /tokens/lint] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tokens/render → render a template with appointmentId or raw patient object
router.post('/render', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { appointmentId, patient, content, selectedSlot } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content_required' });

    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    const tokens = await TemplateToken.find({ $or: [{ org_id }, { org_id: { $exists: false } }] }).lean();

    let patientInfo = patient || null;
    if (!patientInfo && appointmentId) {
      if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ error: 'bad_appointment_id' });
      patientInfo = await Appointment.findOne({ _id: appointmentId, org_id }).lean();
      if (!patientInfo) return res.status(404).json({ error: 'appointment_not_found' });
    }

    const rendered = applyTemplateTokensBackend(String(content), patientInfo || {}, tokens || [], { selectedSlot });
    res.json({ ok: true, rendered });
  } catch (err) {
    console.error('[POST /tokens/render] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/tokens/liquid/render → render Liquid template with patient context
router.post('/liquid/render', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { appointmentId, patient, template, context } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template_required' });

    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    let patientInfo = patient || null;
    if (!patientInfo && appointmentId) {
      if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ error: 'bad_appointment_id' });
      patientInfo = await Appointment.findOne({ _id: appointmentId, org_id }).lean();
      if (!patientInfo) return res.status(404).json({ error: 'appointment_not_found' });
    }

    const tpl = await liquid.parse(template);
    // Compute a convenient latestSlot for Liquid templates if selectedAppDates exists
    let pat = patientInfo || {};
    try {
      if (pat && Array.isArray(pat.selectedAppDates) && pat.selectedAppDates.length > 0) {
        const latest = [...pat.selectedAppDates].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[pat.selectedAppDates.length - 1];
        pat = { ...pat, latestSlot: latest };
      }
    } catch (_) {}
    const ctx = { patient: pat, org: { id: org_id }, ...(context || {}) };
    const rendered = await liquid.render(tpl, ctx);
    res.json({ ok: true, rendered });
  } catch (err) {
    console.error('[POST /tokens/liquid/render] error:', err?.message);
    res.status(400).json({ error: 'render_failed', message: err?.message });
  }
});

// POST /api/tokens/liquid/lint → validate Liquid variables resolution
router.post('/liquid/lint', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { template } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template_required' });
    // Parse to catch syntax errors first
    let tpl;
    try {
      tpl = await liquid.parse(template);
    } catch (e) {
      return res.status(422).json({ ok: false, kind: 'syntax', message: e?.message });
    }
    // Render with empty context to surface unknown variables in strict mode
    try {
      await liquid.render(tpl, { patient: {}, org: {} });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(422).json({ ok: false, kind: 'unknown_variable', message: e?.message });
    }
  } catch (err) {
    console.error('[POST /tokens/liquid/lint] error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ================= Unified endpoints (Liquid + Colon) =================
// POST /api/tokens/unified/render → render template treating Liquid first then colon tokens
router.post('/unified/render', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
  const { template, appointmentId, patient, selectedSlot, calendarSlot } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template_required' });
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    let patientInfo = patient || null;
    if (!patientInfo && appointmentId) {
      if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ error: 'bad_appointment_id' });
      patientInfo = await Appointment.findOne({ _id: appointmentId, org_id }).lean();
      if (!patientInfo) return res.status(404).json({ error: 'appointment_not_found' });
    }

    // Precompute patient context with latestSlot like Liquid endpoint
    let pat = patientInfo || {};
    try {
      if (pat && Array.isArray(pat.selectedAppDates) && pat.selectedAppDates.length > 0) {
        const latest = [...pat.selectedAppDates].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[pat.selectedAppDates.length - 1];
        pat = { ...pat, latestSlot: latest };
      }
    } catch (_) {}

    // If a selectedSlot override is provided, use it for both context and synthetic tokens
    if (selectedSlot && (selectedSlot.startDate || selectedSlot.endDate)) {
      pat = { ...pat, selectedSlot: selectedSlot, latestSlot: { ...(pat.latestSlot || {}), ...selectedSlot } };
    }
    // Attach calendarSlot (independent of per-patient base slot) for calendar-wide selected range tokens
    if (calendarSlot && (calendarSlot.startDate || calendarSlot.endDate)) {
      pat = { ...pat, calendarSlot: calendarSlot };
    }

    const tokens = await TemplateToken.find({ $or: [{ org_id }, { org_id: { $exists: false } }] }).lean();
    const ctx = { patient: pat, org: { id: org_id } };

    const { rendered, liquidUsed } = await unifiedRender({ template, patientInfo: ctx, tokens });
    res.json({ ok: true, rendered, liquidUsed });
  } catch (err) {
    console.error('[POST /tokens/unified/render] error:', err?.message);
    res.status(400).json({ error: 'render_failed', message: err?.message });
  }
});

// POST /api/tokens/unified/lint → combined diagnostics
router.post('/unified/lint', requireAnyPermissionExplain('tokens:read', 'admin:*', 'dev-admin'), async (req, res) => {
  try {
    const { template } = req.body || {};
    if (!template) return res.status(400).json({ error: 'template_required' });
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    const registry = await TemplateToken.find({ $or: [{ org_id }, { org_id: { $exists: false } }] }).select('key').lean();
    const orgColonKeys = registry.map(t => t.key);
    const diagnostics = await unifiedLint({ template, orgColonKeys });
    res.json({ ok: true, ...diagnostics });
  } catch (err) {
    console.error('[POST /tokens/unified/lint] error:', err?.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
