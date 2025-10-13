// src/services/scheduling.service.js
const { DateTime, Interval } = require('luxon');
const Provider = require('../models/Provider/Provider');
const ProviderSchedule = require('../models/Provider/ProviderSchedule');
const ProviderTimeOff = require('../models/Provider/ProviderTimeOff');
const {Appointment, Treatment} = require('../models/Appointments'); // you must ensure this path matches your project
const { subtractIntervals, addMinutes, floorToStep } = require('../helpers/intervals');

const SYD_TZ = 'Australia/Sydney';

function pickActiveSchedule(schedules, fromUtc, toUtc) {
  // Return the schedule whose [effectiveFrom, effectiveTo] overlaps the range, preferring the latest effectiveFrom.
  const from = fromUtc || null;
  const to = toUtc || null;
  const overlapping = schedules.filter(s => {
    const effFrom = s.effectiveFrom ? s.effectiveFrom.getTime() : -Infinity;
    const effTo = s.effectiveTo ? s.effectiveTo.getTime() : Infinity;
    const rangeFrom = from ? from.getTime() : -Infinity;
    const rangeTo = to ? to.getTime() : Infinity;
    return effFrom < rangeTo && rangeFrom < effTo;
  });
  if (overlapping.length === 0) return null;
  overlapping.sort((a, b) => (b.effectiveFrom?.getTime() || 0) - (a.effectiveFrom?.getTime() || 0));
  return overlapping[0];
}

function expandWeeklyToUtcIntervals(weekly, fromUtc, toUtc, tz, includeBreaks = false, breaks = null) {
  // For each day between fromUtc..toUtc (exclusive), expand DayBlocks into UTC intervals.
  const intervals = [];
  const fromLocal = DateTime.fromJSDate(fromUtc).setZone(tz);
  const toLocal = DateTime.fromJSDate(toUtc).setZone(tz);
  let cursor = fromLocal.startOf('day');
  while (cursor < toLocal) {
    const dayKey = cursor.toFormat('ccc').toLowerCase(); // mon..sun
    const blocks = weekly[dayKey] || [];
    for (const block of blocks) {
      const [sh, sm] = block.start.split(':').map(Number);
      const [eh, em] = block.end.split(':').map(Number);
      const startLocal = cursor.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      const endLocal = cursor.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
      if (endLocal <= startLocal) continue;
      const startUtc = startLocal.toUTC().toJSDate();
      const endUtc = endLocal.toUTC().toJSDate();
      intervals.push({ start: startUtc, end: endUtc, meta: { location: block.location, chair: block.chair, dayKey } });
    }
    cursor = cursor.plus({ days: 1 });
  }
  return intervals;
}

function filterByLocationAndChair(intervals, locationId, chairId) {
  return intervals.filter(iv => {
    if (locationId && String(iv.meta.location || '') !== String(locationId)) return false;
    if (chairId && String(iv.meta.chair || '') !== String(chairId)) return false;
    return true;
  });
}

async function getAvailability({ providerId, fromUtc, toUtc, treatmentId, locationId, chairId }) {
  if (!(fromUtc instanceof Date) || !(toUtc instanceof Date) || isNaN(fromUtc) || isNaN(toUtc) || fromUtc >= toUtc) {
    throw new Error('Invalid date range');
  }

  const provider = await Provider.findById(providerId).lean();
  if (!provider || provider.isActive === false) return [];

  // schedule
  const schedules = await ProviderSchedule.find({ provider: providerId }).lean();
  const active = pickActiveSchedule(schedules, fromUtc, toUtc);
  if (!active) return [];
  const baseIntervals = expandWeeklyToUtcIntervals(active.weekly, fromUtc, toUtc, active.timezone || SYD_TZ);
  let workIntervals = baseIntervals;

  // breaks
  if (active.breaks) {
    const breakIntervals = expandWeeklyToUtcIntervals(active.breaks, fromUtc, toUtc, active.timezone || SYD_TZ);
    workIntervals = subtractIntervals(workIntervals, breakIntervals);
  }

  // time off
  const timeOffs = await ProviderTimeOff.find({
    provider: providerId,
    start: { $lt: toUtc },
    end: { $gt: fromUtc },
  }).lean();
  const timeOffIntervals = timeOffs.map(t => ({ start: t.start, end: t.end }));
  workIntervals = subtractIntervals(workIntervals, timeOffIntervals);

  // existing appointments (with buffers)
  const appts = await Appointment.find({
    provider: providerId,
    'selectedDates.startDate': { $lt: toUtc },
    'selectedDates.endDate': { $gt: fromUtc },
  }).select('selectedDates.startDate selectedDates.endDate').lean();

  const before = provider.bufferBefore || 0;
  const after = provider.bufferAfter || 0;
  const apptIntervals = appts.map(a => {
    const s = new Date(a.selectedDates.startDate);
    const e = new Date(a.selectedDates.endDate);
    return { start: new Date(s.getTime() - before * 60000), end: new Date(e.getTime() + after * 60000) };
  });
  workIntervals = subtractIntervals(workIntervals, apptIntervals);

  // filter by location/chair if provided
  workIntervals = filterByLocationAndChair(workIntervals, locationId, chairId);

  // duration logic
  let durationMin = 0;
  if (treatmentId) {
    const treatment = await Treatment.findById(treatmentId).lean();
    if (treatment) {
      const map = provider.defaultDurations || {};
      const override = typeof map.get === 'function' ? map.get(String(treatment._id)) : map[String(treatment._id)];
      durationMin = override || treatment.defaultDuration || 30;
      // Optional: enforce required chair tags here if you also pass chair metadata
      // (omitted for brevity).
    } else {
      durationMin = provider.defaultSlotMinutes || 10;
    }
  } else {
    durationMin = provider.defaultSlotMinutes || 10;
  }

  const step = provider.defaultSlotMinutes || 10;
  const out = [];
  for (const iv of workIntervals) {
    let cursor = floorToStep(iv.start, step);
    if (cursor < iv.start) cursor = new Date(cursor.getTime() + step * 60000);
    while (addMinutes(cursor, durationMin) <= iv.end) {
      const startUtc = cursor;
      const endUtc = addMinutes(cursor, durationMin);
      const startLocal = DateTime.fromJSDate(startUtc).setZone(active.timezone || SYD_TZ);
      const endLocal = DateTime.fromJSDate(endUtc).setZone(active.timezone || SYD_TZ);
      out.push({
        startUtc,
        endUtc,
        localLabel: `${startLocal.toFormat('ccc dd LLL, h:mm a')} – ${endLocal.toFormat('h:mm a')}`,
        meta: iv.meta,
      });
      cursor = addMinutes(cursor, step);
    }
  }
  return out;
}

module.exports = {
  getAvailability,
};
