// helpers/findMatchingAppointments.js
const models = require("../models/Appointments");

// Utilidades de tiempo
function timeStringToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

async function findMatchingAppointments(start, end) {
  const startDate = new Date(start ?? "2025-07-16T15:30:00");
  const endDate   = new Date(end   ?? "2025-07-16T16:30:00");

  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateDayName = daysOfWeek[startDate.getDay()];

  const startMinutes = dateToMinutes(startDate);
  const endMinutes   = dateToMinutes(endDate);
  const requestDuration = endMinutes - startMinutes;

  // Usa el nombre real de la colección según Mongoose
  const PRIORITY_COLL = models.PriorityList.collection.name; // p.ej. 'prioritylists'

  // ---------------- AGGREGATION ----------------
  const appointments = await models.Appointment.aggregate([
    {
      $match: {
        "selectedDates.startDate": { $lte: endDate },
        $or: [
          { "selectedDates.endDate": { $gte: startDate } },
          {
            "selectedAppDates.startDate": { $lte: endDate },
            "selectedAppDates.endDate":   { $gte: startDate },
          },
        ],
      },
    },
    {
      $lookup: {
        from: PRIORITY_COLL,         // 👈 seguro
        localField: "priority",
        foreignField: "_id",
        as: "priority",
      },
    },
    { $unwind: { path: "$priority", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "timeblocks",
        localField: "selectedDates.days.timeBlocks",
        foreignField: "_id",
        as: "selectedDates.days.timeBlocksData",
      },
    },
    {
      $group: {
        _id: "$_id",
        doc:  { $first: "$$ROOT" },
        days: { $push: "$selectedDates.days" },
      },
    },
    { $addFields: { "doc.selectedDates.days": "$days" } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]).exec();

  // ---------------- PRIORITIES ----------------
  const prioritylists = await models.PriorityList.find({}).lean().exec();

  const appointmentsByPriority = new Map();

  for (const priority of prioritylists) {
    const priorityId = String(priority._id);
    const matchedAppointments = [];

    for (const appointment of appointments) {
      if (!appointment.priority || String(appointment.priority._id) !== priorityId) continue;

      // Consider only blocks for the requested weekday
      const blocks = (appointment.selectedDates?.days || [])
        .filter((d) => d?.weekDay === dateDayName)
        .flatMap((d) => d.timeBlocksData || []);

      let totalOverlapMinutes = 0;
      let matchingBlocks = blocks.filter((block) => {
        const blockStart = timeStringToMinutes(block.from);
        const blockEnd   = timeStringToMinutes(block.to);
        const overlapStart = Math.max(startMinutes, blockStart);
        const overlapEnd   = Math.min(endMinutes, blockEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        if (overlap > 0) {
          totalOverlapMinutes += overlap;
          return true;
        }
        return false;
      });

      // Fallback: if no availability blocks for this weekday, try selectedAppDates slots on same weekday
      if (matchingBlocks.length === 0 && Array.isArray(appointment.selectedAppDates)) {
        for (const slot of appointment.selectedAppDates) {
          try {
            const s = new Date(slot.startDate);
            const e = new Date(slot.endDate);
            if (!isFinite(s.getTime()) || !isFinite(e.getTime())) continue;
            const slotDayName = daysOfWeek[s.getDay()];
            if (slotDayName !== dateDayName) continue;
            // Compute overlap in minutes using time of day
            const sMin = dateToMinutes(s);
            const eMin = dateToMinutes(e);
            const overlapStart = Math.max(startMinutes, sMin);
            const overlapEnd   = Math.min(endMinutes, eMin);
            const overlap = Math.max(0, overlapEnd - overlapStart);
            if (overlap > 0) {
              totalOverlapMinutes += overlap;
              const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;
              const fromStr = toHHMM(sMin);
              const toStr = toHHMM(eMin);
              matchingBlocks.push({ from: fromStr, to: toStr, short: 'Slot' });
            }
          } catch (_) {}
        }
      }

      if (matchingBlocks.length > 0) {
        const matchPercentage = (totalOverlapMinutes / requestDuration) * 100;
        matchedAppointments.push({
          ...appointment,
          matchedBlocks: matchingBlocks,
          totalOverlapMinutes,
          matchLevel:
            matchPercentage >= 95 ? "Perfect Match" :
            matchPercentage >= 70 ? "High Match"    :
            matchPercentage >= 40 ? "Medium Match"  : "Low Match",
        });
      }
    }

    matchedAppointments.sort((a, b) => b.totalOverlapMinutes - a.totalOverlapMinutes);
    if (matchedAppointments.length) {
      appointmentsByPriority.set(priorityId, { priority, appointments: matchedAppointments });
    }
  }

  return {
    dateRange: { startDate, endDate },
    priorities: Array.from(appointmentsByPriority.values()),
  };
}

// ❗ No ejecutes consultas al cargar el módulo.
// Si quieres probar este archivo directamente: `node helpers/findMatchingAppointments.js`
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    await connectDB();
    const out = await findMatchingAppointments();
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  })();
}

module.exports = { findMatchingAppointments };
