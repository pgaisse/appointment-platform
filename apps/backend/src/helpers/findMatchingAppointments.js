// helpers/findMatchingAppointments.js
const models = require("../models/Appointments");
const mongoose = require("mongoose");

// Utilidades de tiempo
function timeStringToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * ✨ NUEVA ESTRATEGIA: Buscar por slots con priority/treatment (no por root)
 * 
 * Ahora priority y treatment están en selectedAppDates[].priority/treatment (slot-level)
 * NO en appointment.priority/treatment (root-level, deprecated)
 * 
 * Flujo:
 * 1. Buscar appointments con slots en el rango de fechas del calendario
 * 2. UNWIND slots para procesarlos individualmente
 * 3. POPULATE slot.priority, slot.treatment, slot.providers
 * 4. Filtrar solo slots rebookables (no cancelled, no rejected, con priority/treatment)
 * 5. Calcular matchLevel basado en overlap de availability con el slot propuesto
 * 6. Agrupar por slot.priority para UI
 * 7. Devolver con slotInfo para rebooking
 */
async function findMatchingAppointments(start, end) {
  const startDate = new Date(start ?? "2025-07-16T15:30:00");
  const endDate   = new Date(end   ?? "2025-07-16T16:30:00");

  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateDayName = daysOfWeek[startDate.getDay()];

  const startMinutes = dateToMinutes(startDate);
  const endMinutes   = dateToMinutes(endDate);
  const requestDuration = endMinutes - startMinutes;

  console.log('📊 [findMatchingAppointments] Searching for slots matching:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    dayName: dateDayName,
    startMinutes,
    endMinutes,
    requestDuration,
  });

  // ✅ NUEVA ESTRATEGIA: Crear un resultado por cada SLOT que haga match
  const appointmentSlots = await models.Appointment.aggregate([
    {
      // ⬇️ PASO 1: Buscar appointments con slots en el rango general
      $match: {
        "selectedDates.startDate": { $lte: endDate },
        "selectedDates.endDate": { $gte: startDate },
        selectedAppDates: { $exists: true, $ne: [] },
      },
    },

    // ⬇️ PASO 2: UNWIND slots para procesarlos individualmente
    { $unwind: { path: "$selectedAppDates", preserveNullAndEmptyArrays: false } },

    // ⬇️ PASO 3: Filtrar solo slots rebookables (excluir cancelled/rejected/completed)
    {
      $match: {
        // Excluir slots con status no rebookable
        "selectedAppDates.status": { 
          $nin: ["cancelled", "rejected", "completed", "expired"] 
        },
        // DEBE tener priority para ser categorizado
        "selectedAppDates.priority": { $exists: true, $ne: null },
      },
    },

    // ⬇️ PASO 4: POPULATE slot.priority
    {
      $lookup: {
        from: "PriorityList",
        localField: "selectedAppDates.priority",
        foreignField: "_id",
        as: "selectedAppDates.priority",
      },
    },
    {
      $unwind: {
        path: "$selectedAppDates.priority",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ⬇️ PASO 5: POPULATE slot.treatment
    {
      $lookup: {
        from: "treatments",
        localField: "selectedAppDates.treatment",
        foreignField: "_id",
        as: "selectedAppDates.treatment",
      },
    },
    {
      $unwind: {
        path: "$selectedAppDates.treatment",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ⬇️ PASO 6: POPULATE slot.providers
    {
      $lookup: {
        from: "providers",
        localField: "selectedAppDates.providers",
        foreignField: "_id",
        as: "selectedAppDates.providers",
      },
    },

    // ⬇️ PASO 7: POPULATE selectedDates.days.timeBlocks (patient availability)
    { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "timeblocks",
        localField: "selectedDates.days.timeBlocks",
        foreignField: "_id",
        as: "selectedDates.days.timeBlocksData",
      },
    },

    // ⬇️ PASO 8: GROUP para reconstruir selectedDates.days pero mantener el SLOT individual
    {
      $group: {
        _id: { appointmentId: "$_id", slotId: "$selectedAppDates._id" },
        // Campos del appointment
        contactPreference: { $first: "$contactPreference" },
        sid: { $first: "$sid" },
        nameInput: { $first: "$nameInput" },
        emailInput: { $first: "$emailInput" },
        emailLower: { $first: "$emailLower" },
        phoneInput: { $first: "$phoneInput" },
        phoneE164: { $first: "$phoneE164" },
        lastNameInput: { $first: "$lastNameInput" },
        textAreaInput: { $first: "$textAreaInput" },
        note: { $first: "$note" },
        color: { $first: "$color" },
        user_id: { $first: "$user_id" },
        org_id: { $first: "$org_id" },
        position: { $first: "$position" },
        reschedule: { $first: "$reschedule" },
        // selectedDates con timeBlocks reconstructed
        selectedStartDate: { $first: "$selectedDates.startDate" },
        selectedEndDate: { $first: "$selectedDates.endDate" },
        days: { $push: "$selectedDates.days" },
        // ⬇️ SOLO el slot actual (populated)
        slot: { $first: "$selectedAppDates" },
      },
    },

    // ⬇️ PASO 9: Rebuild estructura para compatibilidad
    {
      $addFields: {
        _id: "$_id.appointmentId",
        slotId: "$_id.slotId",
        selectedDates: {
          startDate: "$selectedStartDate",
          endDate: "$selectedEndDate",
          days: "$days",
        },
        // Crear array de 1 slot para compatibilidad con código existente
        selectedAppDates: ["$slot"],
        // ✅ Copiar priority/treatment del slot al root para compatibilidad
        priority: "$slot.priority",
        treatment: "$slot.treatment",
      },
    },

    // ⬇️ PASO 10: Limpiar campos temporales
    {
      $project: {
        selectedStartDate: 0,
        selectedEndDate: 0,
        slot: 0,
      },
    },
  ]).exec();

  console.log(`✅ [findMatchingAppointments] Found ${appointmentSlots.length} slots with priority/treatment`);

  // ✅ PASO 11: Obtener todas las prioridades (para metadata)
  const prioritylists = await models.PriorityList.find({}).lean().exec();
  console.log(`📋 [findMatchingAppointments] Total priorities in system: ${prioritylists.length}`);

  const appointmentsByPriority = new Map();

  // ✅ NO inicializar con todas las prioridades - solo agregar las que tengan matches

  // ✅ PASO 12: Calcular matchLevel para cada appointment-slot
  for (const appointment of appointmentSlots) {
    const slot = appointment.selectedAppDates?.[0];
    if (!slot?.priority?._id) {
      console.warn(`⚠️ Slot sin priority en appointment ${appointment._id}, ignorando`);
      continue;
    }

    const priorityId = String(slot.priority._id);

    // ⬇️ Calcular overlap con availability blocks del paciente
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

    // ⬇️ Si no hay blocks de availability, marcar como "Low Match" pero incluir igual
    // (para que aparezca en recomendaciones si tiene la priority correcta)
    const matchPercentage = requestDuration > 0 
      ? (totalOverlapMinutes / requestDuration) * 100 
      : 0;

    const matchLevel =
      matchPercentage >= 95 ? "Perfect Match" :
      matchPercentage >= 70 ? "High Match"    :
      matchPercentage >= 40 ? "Medium Match"  : "Low Match";

    // ⬇️ Agregar appointment con info de match
    const enrichedAppointment = {
      ...appointment,
      matchedBlocks: matchingBlocks,
      totalOverlapMinutes,
      matchLevel,
      // ✨ NUEVO: slotInfo para rebooking desde frontend
      slotInfo: {
        slotId: appointment.slotId,
        startDate: slot.startDate,
        endDate: slot.endDate,
        status: slot.status,
        priority: slot.priority,
        treatment: slot.treatment,
        providers: slot.providers || [],
        duration: slot.duration,
        position: slot.position,
      },
    };

    // ⬇️ Agregar a la priority correspondiente (crear grupo si no existe)
    if (!appointmentsByPriority.has(priorityId)) {
      appointmentsByPriority.set(priorityId, {
        priority: slot.priority,
        appointments: [],
      });
    }
    appointmentsByPriority.get(priorityId).appointments.push(enrichedAppointment);
  }

  // ✅ PASO 13: Ordenar appointments por matchLevel dentro de cada priority
  for (const [_, group] of appointmentsByPriority) {
    group.appointments.sort((a, b) => b.totalOverlapMinutes - a.totalOverlapMinutes);
  }

  const result = {
    dateRange: { startDate, endDate },
    priorities: Array.from(appointmentsByPriority.values()),
  };

  console.log('📊 [findMatchingAppointments] Results:', {
    totalPriorities: result.priorities.length,
    prioritiesWithAppointments: result.priorities.filter(p => p.appointments.length > 0).length,
    totalMatches: result.priorities.reduce((sum, p) => sum + p.appointments.length, 0),
    breakdown: result.priorities
      .filter(p => p.appointments.length > 0)
      .map(p => ({
        priority: p.priority.name,
        count: p.appointments.length,
        perfectMatch: p.appointments.filter(a => a.matchLevel === "Perfect Match").length,
        highMatch: p.appointments.filter(a => a.matchLevel === "High Match").length,
        mediumMatch: p.appointments.filter(a => a.matchLevel === "Medium Match").length,
        lowMatch: p.appointments.filter(a => a.matchLevel === "Low Match").length,
      })),
  });

  return result;
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
