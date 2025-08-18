{// CONFIG INDEX.js
  const mongoose = require('mongoose');
  const dotenv = require('dotenv');
  dotenv.config();
 
  ///////////////////////////////////////////////////
}
const mongoose = require("mongoose");
const models = require("../models/Appointments");
const {
  isWithinInterval,
  areIntervalsOverlapping,
  eachDayOfInterval,
  format,
  differenceInMinutes,
} = require("date-fns");



async function findMatchingAppointments(start, end) {
  console.log("🔍 Ejecutando findMatchingAppointments...");

  const startDate = new Date(start ?? "2025-07-16T15:30:00");
  const endDate = new Date(end ?? "2025-07-16T16:30:00");

  console.log("📅 Rango recibido:", startDate.toISOString(), "→", endDate.toISOString());

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateDayName = daysOfWeek[startDate.getDay()];
  console.log("📆 Día de la semana buscado:", dateDayName);

  function timeStringToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function dateToMinutes(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  const startMinutes = dateToMinutes(startDate);
  const endMinutes = dateToMinutes(endDate);
  const requestDuration = endMinutes - startMinutes;
  console.log(`⏱️ Ventana solicitada: ${requestDuration} minutos (${startMinutes} → ${endMinutes})`);

  // ---------------- AGGREGATION ----------------
  const appointments = await models.Appointment.aggregate([
    {
      $match: {
        reschedule: false,
        "selectedDates.startDate": { $lte: endDate },
        $or: [
          { "selectedDates.endDate": { $gte: startDate } },
          {
            "selectedAppDates.startDate": { $lte: endDate },
            "selectedAppDates.endDate": { $gte: startDate },
          },
        ],
        "selectedDates.days.weekDay": dateDayName,
      },
    },
    {
      $addFields: {
        "selectedDates.days": {
          $filter: {
            input: "$selectedDates.days",
            as: "day",
            cond: { $eq: ["$$day.weekDay", dateDayName] },
          },
        },
      },
    },
    {
      $lookup: {
        from: "PriorityList",
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
        doc: { $first: "$$ROOT" },
        days: { $push: "$selectedDates.days" },
      },
    },
    { $addFields: { "doc.selectedDates.days": "$days" } },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);

  console.log(`📥 Appointments encontrados: ${appointments.length}`);
  if (appointments.length > 0) {
    console.log("📄 Ejemplo Appointment:", JSON.stringify(appointments[0], null, 2).substring(0, 500));
  }

  // ---------------- PRIORITIES ----------------
  const prioritylists = await models.PriorityList.find({});
  console.log(`📥 Prioridades encontradas en BD: ${prioritylists.length}`);
  if (prioritylists.length > 0) {
    console.log("📌 Ejemplo Priority:", JSON.stringify(prioritylists[0], null, 2));
  }

  const appointmentsByPriority = new Map();

  for (const priority of prioritylists) {
    const priorityId = priority._id.toString();
    console.log(`➡️ Analizando prioridad: ${priority.name} (${priorityId})`);

    const matchedAppointments = appointments.reduce((acc, appointment) => {
      if (!appointment.priority) {
        console.log(`   ⚠️ Appointment ${appointment._id} sin priority`);
        return acc;
      }

      const apptPriorityId = appointment.priority._id?.toString();
      console.log(`   🔗 Appointment ${appointment._id} priority=${apptPriorityId}, comparando con ${priorityId}`);

      if (apptPriorityId !== priorityId) {
        return acc;
      }

      const blocks = (appointment.selectedDates?.days || []).flatMap((d) => d.timeBlocksData || []);
      console.log(`   🧱 Appointment ${appointment._id} → ${blocks.length} bloques de tiempo`);

      let totalOverlapMinutes = 0;
      const matchingBlocks = blocks.filter((block) => {
        const blockStart = timeStringToMinutes(block.from);
        const blockEnd = timeStringToMinutes(block.to);
        const overlapStart = Math.max(startMinutes, blockStart);
        const overlapEnd = Math.min(endMinutes, blockEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > 0) {
          totalOverlapMinutes += overlap;
          console.log(`      ⏲️ Overlap en bloque ${block.from}-${block.to}: ${overlap} min`);
          return true;
        }
        return false;
      });

      if (matchingBlocks.length > 0) {
        appointment.matchedBlocks = matchingBlocks;
        appointment.totalOverlapMinutes = totalOverlapMinutes;

        const matchPercentage = (totalOverlapMinutes / requestDuration) * 100;
        appointment.matchLevel =
          matchPercentage >= 95
            ? "Perfect Match"
            : matchPercentage >= 70
            ? "High Match"
            : matchPercentage >= 40
            ? "Medium Match"
            : "Low Match";

        console.log(
          `   ✅ Appointment ${appointment._id} → ${appointment.matchLevel} (${matchPercentage.toFixed(
            1
          )}%)`
        );
        acc.push(appointment);
      } else {
        console.log(`   ⛔️ Appointment ${appointment._id} no tiene bloques válidos`);
      }

      return acc;
    }, []);

    matchedAppointments.sort((a, b) => b.totalOverlapMinutes - a.totalOverlapMinutes);

    if (matchedAppointments.length > 0) {
      console.log(`📌 Prioridad ${priority.name} → ${matchedAppointments.length} citas válidas`);
      appointmentsByPriority.set(priorityId, { priority, appointments: matchedAppointments });
    } else {
      console.log(`⛔️ Prioridad ${priority.name} → sin citas en rango`);
    }
  }

  const groupedPriorities = Array.from(appointmentsByPriority.values());

  const result = {
    dateRange: { startDate, endDate },
    priorities: groupedPriorities,
  };

  console.log(`📊 Resultados agrupados por prioridad: ${groupedPriorities.length}`);
  return result;
}






const getTokenInfo = async (token) => {
  const dec = decodeToken(token);
  return { org_id: dec.org_id, azp: dec.azp, sub: dec.sub };
};


findMatchingAppointments();
module.exports = { findMatchingAppointments };
