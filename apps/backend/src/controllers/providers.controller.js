// src/controllers/providers.controller.js
const Provider = require('../models/Provider/Provider');
const ProviderSchedule = require('../models/Provider/ProviderSchedule');
const ProviderTimeOff = require('../models/Provider/ProviderTimeOff');
const { Appointment } = require('../models/Appointments');
const { getAvailability } = require('../services/scheduling.service');
const { validateObjectId } = require('../helpers/validateObjectId');
const { badRequest, notFound } = require('../helpers/httpErrors');

async function listProviders(req, res, next) {
  try {
    const { org, skill, location, active } = req.query;
    const q = {};
    if (org) q.org_id = org;
    if (active !== undefined) q.isActive = active === 'true';
    if (skill) q.skills = validateObjectId(skill, 'skill');
    if (location) q.locations = validateObjectId(location, 'location');
    const items = await Provider.find(q).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

async function createProvider(req, res, next) {
  try {
    const body = req.body || {};
    body.org_id = req.dbUser?.org_id || body?.org_id || null;
    //console.log('[createProvider] req.dbUser:', req.dbUser);
    body.user = req.dbUser?._id || null;
    //console.log('[createProvider] body:', body);
    if (!body.firstName || !body.lastName) throw badRequest('firstName and lastName are required');
    const created = await Provider.create(body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function getProvider(req, res, next) {
  try {
    const id = validateObjectId(req.params.id);
    const item = await Provider.findById(id).lean();
    if (!item) throw notFound('Provider not found');
    res.json(item);
  } catch (err) {
    next(err);
  }
}


// src/controllers/providers.controller.js



async function getProviderAppointments(req, res, next) {
  try {
   

    const providerOid = validateObjectId(req.params.id, 'provider');
    //console.log('[getProviderAppointments] providerOid', String(providerOid));

    // Filtro simple: trae TODOS los appointments donde el provider esté en el array `providers`
    const filter = { providers: providerOid };

    // Proyección mínima útil; incluye selectedAppDates/selectedDates para que el frontend pueda normalizar
    const projection = {
      _id: 1,
      providers: 1,

      // rangos "clásicos" si existen
      startUtc: 1,
      endUtc: 1,
      start: 1,
      end: 1,

      // rangos según tu esquema actual
      selectedAppDates: 1,        // [{ startDate, endDate }]
      selectedDates: 1,           // { startDate, endDate, ... }

      // metadata opcional que el normalizador puede usar
      title: 1,
      notes: 1,
      patient: 1,
      patientName: 1,
      nameInput: 1,
      lastNameInput: 1,
      treatmentName: 1,
      color: 1,
      colorScheme: 1,

      createdAt: 1,
      updatedAt: 1,
    };

    // Ordena si existen campos de fecha; si no, Mongo igual permite el sort sin romper
    const items = await Appointment.find(filter, projection)
      .sort({ startUtc: 1, start: 1 })
      .populate({
        path: 'priority',
        select: 'name color durationHours order isActive', // ajusta a tu esquema
        options: { lean: true },
      })
      .lean();

    const mapped = items.map(a => ({
      ...a,
      priorityId: a.priority?._id ?? null,
      priorityName: a.priority?.name ?? null,
      priorityColor: a.priority?.color ?? a.color ?? null,
      priorityDurationHours: a.priority?.durationHours ?? null,
    }));

    //console.log('[getProviderAppointments] items count', mapped.length);
    //if (mapped.length) console.log('[getProviderAppointments] sample[0]', mapped[0]);

    res.json({ data: mapped, total: mapped.length });
  } catch (err) {
    console.log('[getProviderAppointments] error:', err?.message || err);
    next(err);
  }
}



async function updateProvider(req, res, next) {
  try {
    const id = validateObjectId(req.params.id);
    const body = req.body || {};
    const updated = await Provider.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updated) throw notFound('Provider not found');
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Schedule operations
async function upsertSchedule(req, res, next) {
  try {
    const id = validateObjectId(req.params.id);
    const { weekly, breaks, timezone, effectiveFrom, effectiveTo } = req.body || {};
    if (!weekly) throw badRequest('weekly is required');

    const payload = {
      provider: id,
      weekly,
      breaks: breaks || {},
      timezone: timezone || 'Australia/Sydney',
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      version: 1,
    };

    // simple strategy: create new document (versioning); alternatively, findOneAndUpdate
    const created = await ProviderSchedule.create(payload);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

// Time off
async function createTimeOff(req, res, next) {
  try {
    const id = validateObjectId(req.params.id);
    const { kind, start, end, reason, location, chair } = req.body || {};
    if (!kind || !start || !end) throw badRequest('kind, start, end are required');
    const doc = await ProviderTimeOff.create({
      provider: id,
      kind,
      start: new Date(start),
      end: new Date(end),
      reason: reason || '',
      location: location || null,
      chair: chair || null,
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

// Availability
async function providerAvailability(req, res, next) {
  try {
    const id = validateObjectId(req.params.id);
    const { from, to, treatmentId, location, chair } = req.query;
    if (!from || !to) throw badRequest('from and to are required');
    const slots = await getAvailability({
      providerId: id,
      fromUtc: new Date(from),
      toUtc: new Date(to),
      treatmentId: treatmentId ? validateObjectId(treatmentId, 'treatmentId') : undefined,
      locationId: location ? validateObjectId(location, 'location') : undefined,
      chairId: chair ? validateObjectId(chair, 'chair') : undefined,
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
}
async function listTimeOff(req, res, next) {
  try {
    const id = validateObjectId(req.params.id, 'provider');
    //console.log('[listTimeOff] providerId:', id);
    const { from, to } = req.query;
    //console.log('[listTimeOff] providerId:', id, { from, to });
    const filter = { provider: id };
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      // overlap rule: start < to AND end > from
      filter.$and = [{ start: { $lt: toD } }, { end: { $gt: fromD } }];
    } else if (from) {
      filter.end = { $gt: new Date(from) };
    } else if (to) {
      filter.start = { $lt: new Date(to) };
    }
    //console.log("filter", JSON.stringify(filter))
    const items = await ProviderTimeOff.find(
      filter,
      { _id: 1, kind: 1, start: 1, end: 1, reason: 1, location: 1, chair: 1 }
    ).sort({ start: 1 }).lean();
    //console.log("items", items)
    res.json({ data: items, total: items.length });
  } catch (err) {
    next(err);
  }
}

// helpers locales al controller
function parseISO(name, value) {
  if (!value) throw badRequest(`Missing ${name}`);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`Invalid ${name}`);
  return d;
}
function overlap(a0, a1, b0, b1) {
  return a0 < b1 && a1 > b0;
}
function rangesFromAppointment(a) {
  const out = [];

  // selectedAppDates: [{ startDate, endDate }] (ó propStartDate/propEndDate por compat.)
  if (Array.isArray(a.selectedAppDates)) {
    for (const r of a.selectedAppDates) {
      const s = r?.startDate ?? r?.propStartDate;
      const e = r?.endDate ?? r?.propEndDate;
      if (s && e) out.push([new Date(s), new Date(e)]);
    }
  }
  // selectedDates: { startDate, endDate }
  if (a?.selectedDates?.startDate && a?.selectedDates?.endDate) {
    out.push([new Date(a.selectedDates.startDate), new Date(a.selectedDates.endDate)]);
  }
  // campos legacy
  if (a.startUtc && a.endUtc) out.push([new Date(a.startUtc), new Date(a.endUtc)]);
  if (a.start && a.end) out.push([new Date(a.start), new Date(a.end)]);

  return out.filter(([s, e]) => s < e);
}

const suggestProviders = async (req, res, next) => {
  try {
    const fromD = parseISO('from', req.query.from);
    const toD = parseISO('to', req.query.to);

    // uno o varios tratamientos
    const treatmentIds = Array.isArray(req.query.treatmentIds)
      ? req.query.treatmentIds
      : (req.query.treatmentIds ? [req.query.treatmentIds] : []);
    if (!treatmentIds.length) throw badRequest('Missing treatmentIds');

    const durationMin = req.query.durationMin ? Number(req.query.durationMin) : null;

    // opcionales (si te sirven en getAvailability)
    const locationId = req.query.location ? validateObjectId(req.query.location, 'location') : undefined;
    const chairId = req.query.chair ? validateObjectId(req.query.chair, 'chair') : undefined;

    // 1) providers activos que tengan la(s) skill(s)
    const providers = await Provider.find({
      isActive: true,
      skills: { $in: treatmentIds.map((t) => validateObjectId(t, 'treatmentId')) },
    }).lean();

    if (!providers.length) return res.json({ data: [] });

    const providerIds = providers.map(p => p._id);
    const fromTs = fromD.getTime();
    const toTs = toD.getTime();

    // 2) citas que se solapen con la ventana (varias formas de rango en tu modelo)
    const appts = await Appointment.find({
      providers: { $in: providerIds },
      $or: [
        { selectedAppDates: { $elemMatch: { startDate: { $lt: toD }, endDate: { $gt: fromD } } } },
        { 'selectedDates.startDate': { $lt: toD }, 'selectedDates.endDate': { $gt: fromD } },
        { startUtc: { $lt: toD }, endUtc: { $gt: fromD } },
        { start: { $lt: toD }, end: { $gt: fromD } },
      ],
    }, {
      providers: 1,
      selectedAppDates: 1,
      selectedDates: 1,
      startUtc: 1, endUtc: 1,
      start: 1, end: 1,
    }).lean();

    // 3) time off que se solape
    const pto = await ProviderTimeOff.find({
      provider: { $in: providerIds },
      start: { $lt: toD },
      end: { $gt: fromD },
    }, { provider: 1, start: 1, end: 1 }).lean();

    // 4) disponibilidad real por provider via servicio
    //    (si tu servicio soporta filtrar por tratamiento, pásalo; uso el primero)
    const treatmentIdForAvail = treatmentIds.length ? validateObjectId(treatmentIds[0], 'treatmentId') : undefined;

    const availBy = new Map(); // pid -> [{ startUtc, endUtc }]
    await Promise.all(
      providers.map(async (p) => {
        const slots = await getAvailability({
          providerId: p._id,
          fromUtc: fromD,
          toUtc: toD,
          treatmentId: treatmentIdForAvail,
          locationId,
          chairId,
        });
        availBy.set(String(p._id), Array.isArray(slots) ? slots : []);
      })
    );

    // 5) agrupar appts/pto por provider
    const apptsBy = new Map(); // pid -> appointments[]
    for (const a of appts) {
      for (const pid of (a.providers || [])) {
        const k = String(pid);
        if (!apptsBy.has(k)) apptsBy.set(k, []);
        apptsBy.get(k).push(a);
      }
    }
    const ptoBy = new Map(); // pid -> timeoff[]
    for (const t of pto) {
      const k = String(t.provider);
      if (!ptoBy.has(k)) ptoBy.set(k, []);
      ptoBy.get(k).push(t);
    }

    // 6) score + salida
    const out = [];
    for (const p of providers) {
      const pid = String(p._id);

      // bloqueos por citas
      const hasBusy = (apptsBy.get(pid) || []).some(a =>
        rangesFromAppointment(a).some(([s, e]) => overlap(fromTs, toTs, s.getTime(), e.getTime()))
      );

      // bloqueos por time off
      const hasPTO = (ptoBy.get(pid) || []).some(t =>
        overlap(fromTs, toTs, new Date(t.start).getTime(), new Date(t.end).getTime())
      );

      if (hasBusy || hasPTO) continue;

      // disponibilidad
      const slots = (availBy.get(pid) || []).map(s => ({
        s: new Date(s.startUtc).getTime(),
        e: new Date(s.endUtc).getTime(),
      }));

      const fits = slots.some(b => b.s <= fromTs && b.e >= toTs);
      const partial = !fits && slots.some(b => overlap(b.s, b.e, fromTs, toTs));
      if (!fits && !partial) continue;

      let score = fits ? 2 : 1;
      if (durationMin) {
        const needMs = durationMin * 60 * 1000;
        if (slots.some(b => (b.e - b.s) >= needMs)) score += 0.25;
      }

      out.push({ provider: p, fits, partial, score });
    }

    out.sort((a, b) => (Number(b.fits) - Number(a.fits)) || (b.score - a.score));
    res.json({ data: out });
  } catch (err) {
    next(err);
  }
};
async function getLatestSchedule(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    // Tomamos el schedule más reciente por createdAt (o effectiveFrom desc si prefieres)
    const doc = await ProviderSchedule.findOne({ provider: providerId })
      .sort({ createdAt: -1 })
      .lean();

    if (!doc) return res.json({ data: null });
    res.json({
      data: {
        _id: doc._id,
        provider: doc.provider,
        timezone: doc.timezone,
        weekly: doc.weekly,
        breaks: doc.breaks || {},
        effectiveFrom: doc.effectiveFrom,
        effectiveTo: doc.effectiveTo,
        version: doc.version,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    });
  } catch (err) {
    next(err);
  }
}

// === NEW: actualizar un time off
async function updateTimeOff(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    const toId = validateObjectId(req.params.timeOffId, 'timeOffId');
    const body = req.body || {};

    // Sanitiza entradas permitidas:
    const patch = {};
    if (body.kind) patch.kind = body.kind; // 'PTO' | 'Sick' | ...
    if (body.start) patch.start = new Date(body.start);
    if (body.end) patch.end = new Date(body.end);
    if (typeof body.reason === 'string') patch.reason = body.reason;
    if (body.location) patch.location = validateObjectId(body.location, 'location');
    if (body.chair) patch.chair = validateObjectId(body.chair, 'chair');

    const updated = await ProviderTimeOff.findOneAndUpdate(
      { _id: toId, provider: providerId },
      { $set: patch },
      { new: true }
    ).lean();

    if (!updated) throw notFound('Time off not found');
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

// === NEW: eliminar un time off
async function deleteTimeOff(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    const toId = validateObjectId(req.params.timeOffId, 'timeOffId');

    const del = await ProviderTimeOff.findOneAndDelete({ _id: toId, provider: providerId }).lean();
    if (!del) throw notFound('Time off not found');

    res.json({ ok: true, deletedId: toId });
  } catch (err) {
    next(err);
  }
}

async function blockAvailability(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    const { start, end, reason, location, chair } = req.body || {};
    if (!start || !end) throw badRequest('start and end are required');

    const doc = await ProviderTimeOff.create({
      provider: providerId,
      kind: 'Block',
      start: new Date(start),
      end: new Date(end),
      reason: reason || 'Availability block',
      location: location ? validateObjectId(location, 'location') : null,
      chair: chair ? validateObjectId(chair, 'chair') : null,
    });

    res.status(201).json({ data: doc });
  } catch (err) { next(err); }
}

// GET /providers/:id/availability/blocks?from&to
// Solo devuelve TimeOff con kind='Block', con opcional solape por rango.
async function listAvailabilityBlocks(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    const { from, to } = req.query;

    const filter = { provider: providerId, kind: 'Block' };
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      filter.$and = [{ start: { $lt: toD } }, { end: { $gt: fromD } }];
    } else if (from) {
      filter.end = { $gt: new Date(from) };
    } else if (to) {
      filter.start = { $lt: new Date(to) };
    }

    const items = await ProviderTimeOff
      .find(filter, { _id: 1, kind: 1, start: 1, end: 1, reason: 1, location: 1, chair: 1 })
      .sort({ start: 1 })
      .lean();

    res.json({ data: items, total: items.length });
  } catch (err) { next(err); }
}

// DELETE /providers/:id/availability/blocks/:blockId
// Borra SOLO si es kind='Block'
async function deleteAvailabilityBlock(req, res, next) {
  try {
    const providerId = validateObjectId(req.params.id, 'provider');
    const blockId = validateObjectId(req.params.blockId, 'blockId');

    const toDelete = await ProviderTimeOff.findOne({ _id: blockId, provider: providerId }).lean();
    if (!toDelete) throw notFound('Availability block not found');
    if (toDelete.kind !== 'Block') throw badRequest('The specified time off is not a Block');

    await ProviderTimeOff.deleteOne({ _id: blockId, provider: providerId });
    res.json({ ok: true, deletedId: blockId });
  } catch (err) { next(err); }
}


module.exports = {
  getLatestSchedule,
  updateTimeOff,
  deleteTimeOff,
  suggestProviders,
  listTimeOff,
  getProviderAppointments,
  listProviders,
  createProvider,
  getProvider,
  updateProvider,
  upsertSchedule,
  createTimeOff,
  providerAvailability,
  blockAvailability,
  listAvailabilityBlocks,
  deleteAvailabilityBlock,
};
