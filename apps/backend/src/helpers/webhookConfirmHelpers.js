// webhookConfirmHelpers.js

/**
 * Clasifica un texto de respuesta SIN tokens (C/X/R).
 * @param {string} body
 * @returns {"confirmed"|"declined"|"reschedule"|"unknown"}
 */
function decideFromBody(body = "") {
  const t = (body || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

  // YES al inicio
  const YES = /^\s*(?:si|s[ií]?|ok(?:ay|ey)?|vale|dale|confirm(?:o|ar|ado|ada|ed|ing)?|listo|de acuerdo|perfecto|correcto|yes|yep|yeah|yup|sure|of course|certainly|absolutely|alright|all right|agreed|i agree|sounds good|works for me)\b/iu;

  // NO al inicio
  const NO = /^\s*(?:no|nop|nah|cance(?:l|la|lar|led|ling)?|no puedo|no voy|rechazo|declin(?:e|ed|ing|o)|can'?t|cannot|won'?t|will not|not coming|not attending|do not|don't)\b/iu;

  // RE en cualquier parte
  const RE = /\b(?:reagendar|reagenda|otro dia|otra fecha|cambiar\s+(?:hora|fecha)|reprogramar|posponer|move|reschedul(?:e|ing)|rebook|rearrange|change\s+(?:time|date)|push\s*back|bring\s*forward|postpone|delay|later|earlier)\b/iu;


  if (YES.test(t)) return "confirmed";
  if (NO.test(t)) return "declined";
  if (RE.test(t)) return "reschedule";
  return "unknown";
}

/**
 * Encuentra el último OUTBOUND con type="Confirmation" del MISMO hilo,
 * anterior al inbound actual, no resuelto y dentro de una ventana de tiempo.
 *
 * @param {Object} params
 * @param {import("mongoose").Model} params.Message   - Modelo Mongoose de Message
 * @param {string} params.conversationId
 * @param {number|undefined} params.nowIndex         - index numérico del inbound actual (si lo tienes)
 * @param {Date} [params.nowCreatedAt=new Date()]    - createdAt del inbound actual (fallback si no hay index)
 * @param {number} [params.maxAgeMs=72*3600*1000]    - ventana de tiempo (por defecto 72h)
 * @returns {Promise<Object|null>}                   - Documento lean() del mensaje previo o null
 */
async function findPrevOutboundConfirmation({
  Message,
  conversationId,
  nowIndex,
  nowCreatedAt = new Date(),
  maxAgeMs = 72 * 3600 * 1000,
}) {
  const now = new Date();

  const q = {
    conversationId,
    direction: "outbound",
    type: "Confirmation",
    $or: [{ resolvedBySid: null }, { resolvedBySid: { $exists: false } }],
    createdAt: { $gte: new Date(now.getTime() - maxAgeMs) },
  };
  console.log("q", q)

  // Si tienes index numérico fiable, úsalo para garantizar que sea "anterior"
  if (typeof nowIndex === "number" && !Number.isNaN(nowIndex)) {
    q.index = { $lt: nowIndex };
  } else {
    // Respaldo por tiempo si no hay index numérico
    q.createdAt.$lt = nowCreatedAt;
  }
  console.log("q2", q)
  const query=await Message.findOne(q).sort({ index: -1, createdAt: -1 }).lean();
  console.log("query",query)
  return query
}

/**
 * Elige el "slot" activo (subdocumento del array selectedAppDates) para aplicar cambios.
 * Reglas:
 *  1) Preferir estados activos: Pending | Contacted | NotStarted | NoContacted
 *  2) Dentro de activos, preferir el futuro más cercano (startDate >= ahora)
 *  3) Si no hay futuros, tomar el más reciente por startDate
 *  4) Último recurso: primer elemento del array
 *
 * @param {Object} params
 * @param {import("mongoose").Model} params.Appointment  - Modelo Mongoose de Appointment
 * @param {string} params.conversationId                 - Appointment.sid
 * @param {Date}   [params.now=new Date()]
 * @returns {Promise<string|null>}                       - slotId (ObjectId string) o null si no hay slots
 */
async function pickActiveSlotId({ Appointment, conversationId, now = new Date() }) {
  const appt = await Appointment.findOne(
    { sid: conversationId, unknown: { $ne: true } }, // excluye unknown:true
    { selectedAppDates: 1 }
  ).lean();

  const arr = appt?.selectedAppDates || [];
  if (!arr.length) return null;

  const ACTIVE = new Set(["Pending", "Contacted", "NotStarted", "NoContacted"]);

  // 1) futuros activos: el más cercano
  const futureActives = arr
    .filter(s => ACTIVE.has(s.status) && s.startDate && new Date(s.startDate) >= now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (futureActives.length) return String(futureActives[0]._id);

  // 2) si no hay futuros, el más reciente por fecha
  const withDates = arr
    .filter(s => s.startDate)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  if (withDates.length) return String(withDates[0]._id);

  // 3) fallback
  return String(arr[0]._id);
}

/**
 * Selecciona el slot Pending más recientemente modificado (por proposed.createdAt o updatedAt).
 * En el nuevo modelo de rebooking ya no se crean slots adicionales; se edita uno existente y se pone en status Pending.
 * Para confirmar la respuesta del paciente queremos EXACTAMENTE ese slot.
 * Reglas:
 * 1) Filtrar slots con status === 'Pending'
 * 2) Ordenar por (slot.proposed.createdAt || slot.updatedAt || slot.startDate) DESC
 * 3) Tomar el primero.
 * 4) Si no hay Pending, devolver null (el caller hará fallback a heurística previa).
 */
async function pickLastModifiedPendingSlotId({ Appointment, conversationId }) {
  const appt = await Appointment.findOne(
    { sid: conversationId, unknown: { $ne: true } },
    { selectedAppDates: 1 }
  ).lean();

  const arr = appt?.selectedAppDates || [];
  if (!arr.length) return null;

  const pendings = arr.filter(s => s.status === 'Pending');
  if (!pendings.length) return null;

  // map with sort key
  const scored = pendings.map(s => {
    const proposedAt = s?.proposed?.createdAt ? new Date(s.proposed.createdAt).getTime() : 0;
    const updatedAt = s?.updatedAt ? new Date(s.updatedAt).getTime() : 0;
    const startAt = s?.startDate ? new Date(s.startDate).getTime() : 0;
    // prioridad: proposed.createdAt > updatedAt > startDate
    const score = proposedAt || updatedAt || startAt;
    return { slot: s, score };
  }).sort((a,b) => b.score - a.score);

  return scored.length ? String(scored[0].slot._id) : null;
}

module.exports = {
  decideFromBody,
  findPrevOutboundConfirmation,
  pickActiveSlotId,
  pickLastModifiedPendingSlotId,
};
