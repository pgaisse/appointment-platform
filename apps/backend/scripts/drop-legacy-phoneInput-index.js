#!/usr/bin/env node
/*
 * Drops any legacy unique index on appointments.phoneInput.
 * Safe to run multiple times. Requires MONGODB_URI or MONGO_URI in env.
 */
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/productionDB';
  const dbNameFromUri = (() => {
    try {
      const url = new URL(uri);
      const path = url.pathname.replace(/^\//, '');
      return path || process.env.MONGO_DB || 'productionDB';
    } catch {
      return process.env.MONGO_DB || 'productionDB';
    }
  })();

  console.log(`[migrate] Connecting to ${uri} ...`);
  await mongoose.connect(uri, {
    dbName: dbNameFromUri,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    const db = mongoose.connection.db;
    const coll = db.collection('appointments');
    const indexes = await coll.indexes();

    const targets = indexes.filter(ix => ix?.unique && ix?.key && ix.key.phoneInput === 1);
    if (!targets.length) {
      console.log('[migrate] No unique index on { phoneInput: 1 } found. Nothing to do.');
    } else {
      for (const ix of targets) {
        console.log(`[migrate] Dropping index ${ix.name} ...`);
        await coll.dropIndex(ix.name);
        console.log(`[migrate] Dropped ${ix.name}`);
      }
    }

    console.log('[migrate] Done.');
    process.exit(0);
  } catch (e) {
    console.error('[migrate] Error:', e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
