#!/usr/bin/env node
/*
 Backfill script: populate proposedStartDate/proposedEndDate and selectedAppDate
 for existing ContactAppointment documents lacking these fields.

 Logic:
 1. Find ContactAppointment where (proposedStartDate == null || proposedEndDate == null)
 2. For each, load its Appointment.selectedAppDates (minimal projection)
 3. Match slot by:
    a) selectedAppDate (direct lookup) OR
    b) askMessageSid (slot.confirmation.askMessageSid) OR
    c) startDate/endDate == slot.startDate/endDate OR
       startDate/endDate == slot.proposed.startDate/endDate
 4. If matched and slot.proposed has start/end, set proposedStartDate/proposedEndDate.
 5. If matched and ContactAppointment.selectedAppDate missing, set it.

 Run: node scripts/backfillProposedContactAppointments.js
 Ensure you have MONGODB_URI and any auth env vars loaded (.env).
*/

const mongoose = require('mongoose');
require('dotenv').config();
const { Appointment, ContactAppointment } = require('../src/models/Appointments');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/productionDB';
  console.log('🔌 Connecting to', uri);
  await mongoose.connect(uri);

  const query = {
    $or: [
      { proposedStartDate: { $exists: false } },
      { proposedStartDate: null },
      { proposedEndDate: { $exists: false } },
      { proposedEndDate: null },
    ],
  };

  const batch = await ContactAppointment.find(query).limit(5000).lean();
  console.log(`Encontrados ${batch.length} ContactAppointment para revisar.`);

  let updated = 0;

  for (const ca of batch) {
    try {
      const appt = await Appointment.findById(ca.appointment, {
        selectedAppDates: 1,
      }).lean();
      if (!appt || !Array.isArray(appt.selectedAppDates)) continue;

      let slot = null;

      // 1) selectedAppDate directo
      if (ca.selectedAppDate) {
        slot = appt.selectedAppDates.find((s) => String(s._id) === String(ca.selectedAppDate)) || null;
      }

      // 2) askMessageSid
      if (!slot && ca.askMessageSid) {
        slot = appt.selectedAppDates.find(
          (s) => s?.confirmation?.askMessageSid === ca.askMessageSid
        ) || null;
      }

      // 3) match por fechas
      if (!slot && ca.startDate && ca.endDate) {
        const st = new Date(ca.startDate).getTime();
        const et = new Date(ca.endDate).getTime();
        slot = appt.selectedAppDates.find((s) => {
          const t1 = s?.startDate ? new Date(s.startDate).getTime() : NaN;
          const t2 = s?.endDate ? new Date(s.endDate).getTime() : NaN;
          const p1 = s?.proposed?.startDate ? new Date(s.proposed.startDate).getTime() : NaN;
          const p2 = s?.proposed?.endDate ? new Date(s.proposed.endDate).getTime() : NaN;
          return (t1 === st && t2 === et) || (p1 === st && p2 === et);
        }) || null;
      }

      if (!slot) continue;

      const hasProposed = slot?.proposed?.startDate && slot?.proposed?.endDate;
      const needsProposed = !(ca.proposedStartDate && ca.proposedEndDate) && hasProposed;
      const needsSlotId = !ca.selectedAppDate;

      if (!needsProposed && !needsSlotId) continue;

      const update = {};
      if (needsProposed) {
        update.proposedStartDate = slot.proposed.startDate;
        update.proposedEndDate = slot.proposed.endDate;
      }
      if (needsSlotId) update.selectedAppDate = slot._id;

      await ContactAppointment.updateOne({ _id: ca._id }, { $set: update });
      updated++;
    } catch (e) {
      console.warn('⚠️ Error procesando CA', ca._id, e.message);
    }
  }

  console.log(`✅ Actualizados ${updated} ContactAppointment.`);
  await mongoose.disconnect();
  console.log('🔌 Conexión cerrada.');
}

main().catch((e) => {
  console.error('❌ Error global:', e);
  process.exit(1);
});
