#!/usr/bin/env node
/**
 * src/helpers/dedupe-standalone.js
 * Stand-alone Mongo/Mongoose dedupe script.
 * - Carga .env (si existe)
 * - Soporta modos: field | composite | phone-au
 * - Mantiene el doc más nuevo (createdAt desc, fallback _id desc)
 * - --dry-run para vista previa
 * - --create-unique-index para prevenir futuros duplicados
 */

const mongoose = require("mongoose");
const path = require("path");

// --- Cargar .env (opcional) ---
(function loadDotEnv() {
  try {
    const idx = process.argv.indexOf("--env");
    if (idx !== -1 && process.argv[idx + 1]) {
      require("dotenv").config({ path: process.argv[idx + 1] });
    } else {
      require("dotenv").config(); // por defecto busca .env en cwd
    }
  } catch (_) {
    // dotenv no instalado: continuar con process.env
  }
})();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) args[k] = true;
      else { args[k] = v; i++; }
    }
  }
  return args;
}

function mask(uri) {
  return String(uri).replace(/\/\/([^@]*?)@/, "//***:***@");
}

function buildUriFromEnv() {
  const {
    MONGO_URI,
    MONGO_USER,
    MONGO_PASS,
    MONGO_HOST = "localhost",
    MONGO_PORT = "27017",
    MONGO_DB = "test",
    MONGO_AUTH_SOURCE = "admin",
    MONGO_RS,
    MONGO_DIRECT_CONNECTION,
  } = process.env;

  if (MONGO_URI) return MONGO_URI;

  const creds = MONGO_USER
    ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS || "")}@`
    : "";

  const params = new URLSearchParams();
  if (MONGO_AUTH_SOURCE) params.set("authSource", MONGO_AUTH_SOURCE);

  if (MONGO_RS) {
    params.set("replicaSet", MONGO_RS);
    params.set("retryWrites", "true");
    params.set("w", "majority");
    params.set("directConnection", "false");
  } else if (typeof MONGO_DIRECT_CONNECTION !== "undefined") {
    params.set("directConnection", String(MONGO_DIRECT_CONNECTION) === "true" ? "true" : "false");
  } else {
    params.set("directConnection", "true");
    params.set("retryWrites", "false");
  }

  return `mongodb://${creds}${MONGO_HOST}:${MONGO_PORT}/${encodeURIComponent(MONGO_DB)}?${params.toString()}`;
}

function canonPhoneAU(p) {
  if (p == null) return null;
  let s = String(p).trim().replace(/[^\d+]/g, "");
  if (s.startsWith("+61")) return "+61" + s.slice(3);
  if (s.startsWith("61"))  return "+61" + s.slice(2);
  if (s.startsWith("0"))   return "+61" + s.slice(1);
  if (/^\d{9,10}$/.test(s)) return "+61" + s.replace(/^0/, "");
  return s || null;
}

function sortStage() { return { createdAt: -1, _id: -1 }; }

function matchAllExist(fields) {
  return { $and: fields.map(f => ({ [f]: { $exists: true, $ne: null } })) };
}

async function aggregateByField(coll, field) {
  return coll.aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: "$" + field,
        keep: { $first: "$_id" },           // <-- antes decía "$._id"
        ids:  { $push: "$_id" },            // <-- antes decía "$._id"
        count:{ $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        keep: 1,
        count: 1,
        toDelete: {
          $setDifference: ["$ids", ["$keep"]]
        }
      }
    }
  ], { allowDiskUse: true });
}

async function aggregateByComposite(coll, fields) {
  const keyObj = Object.fromEntries(fields.map(f => [f, "$" + f]));
  return coll.aggregate([
    { $match: { $and: fields.map(f => ({ [f]: { $exists: true, $ne: null } })) } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id:  keyObj,
        keep: { $first: "$_id" },          // <-- "$_id" correcto
        ids:  { $push: "$_id" },           // <-- "$_id" correcto
        count:{ $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        keep: 1,
        count: 1,
        toDelete: {
          $setDifference: ["$ids", ["$keep"]]
        }
      }
    }
  ], { allowDiskUse: true });
}


async function materializePhoneKeyAU(coll) {
  const cursor = coll.find({}, { projection: { _id: 1, phoneE164: 1, phoneInput: 1, phoneKey: 1 } });
  let ops = 0, bulk = [];
  while (await cursor.hasNext()) {
    const d = await cursor.next();
    const key = canonPhoneAU(d.phoneE164 ?? d.phoneInput);
    if (key !== (d.phoneKey ?? null)) {
      bulk.push({ updateOne: { filter: { _id: d._id }, update: { $set: { phoneKey: key } } } });
      if (bulk.length >= 1000) { await coll.bulkWrite(bulk, { ordered: false }); ops += bulk.length; bulk = []; }
    }
  }
  if (bulk.length) { await coll.bulkWrite(bulk, { ordered: false }); ops += bulk.length; }
  return ops;
}

async function deleteInBatches(coll, ids, size, dryRun) {
  let total = 0;
  for (let i = 0; i < ids.length; i += size) {
    const slice = ids.slice(i, i + size);
    if (dryRun) total += slice.length;
    else {
      const res = await coll.deleteMany({ _id: { $in: slice } });
      total += res.deletedCount || 0;
    }
  }
  return total;
}

async function ensureUniqueIndex(coll, spec) {
  await coll.createIndex(spec, { unique: true, sparse: true });
}

async function connect() {
  const uri = buildUriFromEnv();
  const timeout = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000);
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: timeout, family: 4 });
    // log básico sin credenciales
    console.log("✅ MongoDB connected:", mask(uri));
    return conn.connection;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err?.message || err);
    if (/EAI_AGAIN|ENOTFOUND/.test(String(err?.message))) {
      console.error("👉 El hostname de Mongo no resuelve en este contexto. Si usas Docker Compose, ejecuta este script dentro de la misma red o usa MONGO_URI con un host resoluble (p. ej. 127.0.0.1).");
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const collection = args.collection;
  const mode = String(args.mode || "field");
  const field = args.field;
  const composite = args.composite ? String(args.composite).split(",").map(s => s.trim()).filter(Boolean) : null;
  const batch = Math.max(1, parseInt(args.batch || "1000", 10));
  const dryRun = Boolean(args["dry-run"]);
  const makeUnique = Boolean(args["create-unique-index"]);

  if (!collection) { console.error("✖ Falta --collection <nombre>"); process.exit(1); }
  if (mode === "field" && !field) { console.error("✖ mode=field requiere --field <campo>"); process.exit(1); }
  if (mode === "composite" && (!composite || composite.length < 2)) {
    console.error("✖ mode=composite requiere --composite f1,f2,... (≥2 campos)"); process.exit(1);
  }

  const conn = await connect();
  try {
    const coll = conn.collection(collection);
    let cursor, uniqueSpec = null;

    if (mode === "phone-au") {
      console.log("▶ Normalizando phoneKey (AU) desde phoneE164/phoneInput…");
      const upserts = await materializePhoneKeyAU(coll);
      console.log(`✔ Registros actualizados (phoneKey): ${upserts}`);

      console.log("▶ Buscando duplicados por phoneKey…");
      cursor = await aggregateByField(coll, "phoneKey");
      uniqueSpec = { phoneKey: 1 };
    } else if (mode === "field") {
      console.log(`▶ Buscando duplicados por campo: ${field}…`);
      cursor = await aggregateByField(coll, field);
      uniqueSpec = { [field]: 1 };
    } else if (mode === "composite") {
      console.log(`▶ Buscando duplicados por clave compuesta: ${composite.join(", ")}…`);
      cursor = await aggregateByComposite(coll, composite);
      uniqueSpec = Object.fromEntries(composite.map(f => [f, 1]));
    } else {
      console.error(`✖ mode desconocido: ${mode}`); process.exit(1);
    }

    let groups = 0;
    const toDelete = [];
    while (await cursor.hasNext()) {
      const d = await cursor.next();
      groups++;
      if (Array.isArray(d.toDelete) && d.toDelete.length) toDelete.push(...d.toDelete);
    }

    console.log(`▶ Grupos duplicados: ${groups}`);
    console.log(`▶ Documentos a eliminar: ${toDelete.length}`);
    if (dryRun) console.log("ℹ Dry run — no se elimina nada.");

    const deleted = await deleteInBatches(coll, toDelete, batch, dryRun);
    console.log(`${dryRun ? "✔ (Dry)" : "✔"} Eliminados: ${deleted}`);

    if (makeUnique && uniqueSpec) {
      console.log("▶ Creando índice único (sparse) para prevenir duplicados…");
      await ensureUniqueIndex(coll, uniqueSpec);
      console.log("✔ Índice único creado:", uniqueSpec);
    }
  } finally {
    await mongoose.connection.close();
  }
}

main().catch(err => {
  console.error("✖ Error:", err?.stack || err?.message || err);
  process.exit(1);
});
