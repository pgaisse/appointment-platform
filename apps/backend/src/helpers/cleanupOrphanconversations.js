#!/usr/bin/env node
/* cleanupOrphanConversations.js
 * - Carga conversationId (CH...) desde Mongo (collection: appointments)
 * - Lista todas las Conversations en tu Service de Twilio
 * - Borra en Twilio las que NO existan en la BD
 *
 * Requiere .env.backend.dev con:
 * MONGO_*, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CONVERSATIONS_SERVICE_SID
 * DRY_RUN=true|false, KEEP_SIDS=CH...,CH..., PAGE_SIZE=200 (opcional)
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.backend.dev"),
});

const mongoose = require("mongoose");
const twilio = require("twilio");
const connectDB = require("../config/db");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_CONVERSATIONS_SERVICE_SID: SERVICE_SID,
  DRY_RUN = "false",
  KEEP_SIDS = "",
  PAGE_SIZE = "200",
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !SERVICE_SID) {
  console.error("❌ Faltan credenciales de Twilio o SERVICE_SID en el .env");
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const DRY = String(DRY_RUN).toLowerCase() === "true";
const KEEP = new Set(KEEP_SIDS.split(",").map((s) => s.trim()).filter(Boolean));

// ——— Modelo mínimo de Appointment ———
const appointmentSchema = new mongoose.Schema(
  {
    conversationId: { type: String },
  },
  { collection: "appointments", versionKey: false }
);

const Appointment = mongoose.model("Appointment", appointmentSchema);

// ——— Utils ———
const CH_REGEX = /^CH[0-9a-fA-F]{32}$/;

function isValidCH(sid) {
  return CH_REGEX.test(String(sid || ""));
}

async function loadValidConversationIds() {
  const rows = await Appointment.find(
    { sid: { $exists: true, $ne: null } },
    { sid: 1, _id: 0 }
  ).lean();

  const set = new Set();
  for (const r of rows) {
    const sid = r.sid;
    if (isValidCH(sid)) set.add(sid);
  }
  return set;
}

async function listAllServiceConversations(serviceSid, pageSize = 200) {
  const conversations = [];
  let page = await client.conversations.v1
    .services(serviceSid)
    .conversations.page({ pageSize });

  while (page) {
    conversations.push(...page.instances);
    page = page.nextPage ? await page.nextPage() : null;
  }
  return conversations;
}

async function deleteConversation(serviceSid, conversationSid) {
  await client.conversations.v1
    .services(serviceSid)
    .conversations(conversationSid)
    .remove();
}

(async function main() {
  console.log("▶️ Iniciando limpieza de Conversations huérfanas...");
  console.log("   DRY_RUN =", DRY);
  console.log("   SERVICE =", SERVICE_SID);

  // 1) Conectar Mongo usando tu helper
  await connectDB();

  // 2) SIDs válidos en BD
  const valid = await loadValidConversationIds();
  console.log(`📚 BD: ${valid.size} conversationId (CH…) válidos.`);

  // 3) Todas las conversations del Service
  const pageSize = Number(PAGE_SIZE) || 200;
  const all = await listAllServiceConversations(SERVICE_SID, pageSize);
  console.log(`💬 Twilio (Service ${SERVICE_SID}): ${all.length} conversations encontradas.`);

  // 4) Calcular huérfanas
  const orphans = [];
  for (const c of all) {
    const sid = c.sid;
    if (!isValidCH(sid)) continue;
    if (KEEP.has(sid)) continue;
    if (!valid.has(sid)) {
      orphans.push({ sid, state: c.state, dateCreated: c.dateCreated });
    }
  }

  console.log(`🧹 Candidatas a borrar (no están en BD, excluyendo KEEP): ${orphans.length}`);
  if (orphans.length) {
    console.table(
      orphans.map((o) => ({
        sid: o.sid,
        state: o.state,
        created: o.dateCreated,
      }))
    );
  }

  // 5) Borrado
  if (DRY) {
    console.log("🔎 DRY_RUN activo — no se borra nada. Desactiva DRY_RUN para aplicar.");
  } else {
    let ok = 0,
      fail = 0;
    for (const { sid } of orphans) {
      try {
        await deleteConversation(SERVICE_SID, sid);
        console.log("✅ Deleted", sid);
        ok++;
      } catch (e) {
        console.warn("⚠️ Error deleting", sid, e?.status || e?.code || e?.message);
        fail++;
      }
    }
    console.log(`✔️ Fin: ${ok} borradas, ${fail} con error.`);
  }

  await mongoose.disconnect();
  console.log("🏁 Listo.");
})().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
