#!/usr/bin/env node
/**
 * Backfill script: ensure Appointment.providers includes all distinct provider IDs
 * referenced in providersAssignments. Safe, idempotent (can run multiple times).
 *
 * Usage (from repo root):
 *   node apps/backend/scripts/backfill-providers-from-assignments.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/appointment-platform';
  await mongoose.connect(uri, { autoIndex: false });
  const { Appointment } = require('../src/models/Appointments');

  console.log('🔧 Starting backfill of providers from providersAssignments');

  const cursor = Appointment.find({ providersAssignments: { $exists: true, $ne: [] } })
    .select('_id providers providersAssignments')
    .cursor();

  let processed = 0;
  let updated = 0;

  for await (const appt of cursor) {
    processed++;
    const before = new Set((appt.providers || []).map(p => String(p)));
    let changed = false;

    for (const pa of appt.providersAssignments || []) {
      if (pa.provider && !before.has(String(pa.provider))) {
        appt.providers.push(pa.provider);
        before.add(String(pa.provider));
        changed = true;
      }
    }

    if (changed) {
      await appt.save();
      updated++;
      if (updated % 50 === 0) console.log(`✅ Updated ${updated} appointments so far...`);
    }
  }

  console.log(`🏁 Backfill complete. Processed: ${processed}, Updated: ${updated}.`);
  await mongoose.disconnect();
})();
