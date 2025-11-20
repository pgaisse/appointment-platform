const express = require('express');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { ContactStatus, MsgType } = require("../constants")
const DOMPurify = require('isomorphic-dompurify');
const { Appointment, MessageLog, MediaFile, Message, ContactAppointment } = require('../models/Appointments');
const sms = require('../helpers/conversations')
const helpers = require('../helpers');
const multer = require("multer");
const aws = require('../helpers/aws');
const twilio = require('twilio');
const router = express.Router();
const mongoose = require('mongoose');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, verifyJwtManually, ensureUser } = require('../middleware/auth');
const { syncUserFromToken } = require('../middleware/sync-user');
const { SendMessageSchema } = require("../schemas/messages");
const { uploadImageFromUrl, getFileMetadata, getPublicImageLink } = require('../helpers/imagesManagment')
const { receiveMessage } = require('../controllers/message.controller');
const Appointments = require('../models/Appointments');
const { getSmsBindingFromWebhookPayload } = require('../utils/twilio-conversations-binding');
const { Organization } = require("../models/Enviroment/Org")
const { queueInvalidate, flushInvalidate } = require('../socket/invalidate-queue');
const ConversationRead = require('../models/Chat/ConversationRead');
const ConversationState = require('../models/Chat/ConversationState');
const { autoUnarchiveOnInbound } = require('../helpers/autoUnarchiveOnInbound');
const { DateTime } = require("luxon");
const { validateConversationSid } = require('../helpers/twilioHealth');

const {
  decideFromBody,
  findPrevOutboundConfirmation,
  pickActiveSlotId,
  pickLastModifiedPendingSlotId,
} = require("../helpers/webhookConfirmHelpers");

const {
  listChatCategories,
  createChatCategory,
  updateChatCategory,
  assignCategoryToConversation,
  listConversationCategories,
  unassignCategoryFromConversation,
} = require("../models/Chat/chatCategorizationService");


function makeSyntheticIndex() {
  // segundos desde epoch (≈1e9) y 3 dígitos de aleatorio → 32 bits sobran
  const ts = Math.floor(Date.now() / 1000);      // p.ej. 1739900000
  const rand = Math.floor(Math.random() * 1000); // 0..999
  return -(ts * 1000 + rand);                    // p.ej. -173990000012
}
const storage = multer.memoryStorage();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID;
const client = twilio(accountSid, authToken);
const MG_SID = process.env.TWILIO_MESSAGING_SERVICE_SID; // Messaging Service for scheduling

router.use(
  ['/sendMessage', '/sendMessageAsk', '/conversations', '/messages', '/categories'],
  jwtCheck,
  attachUserInfo,
  ensureUser
);


// Detecta errores típicos de Twilio cuando el Conversation SID no existe/es inválido
function isConvSidInvalid(err) {
  const msg = String(err?.message || '').toLowerCase();
  const status = err?.status || err?.statusCode;
  const code = err?.code;
  return (
    status === 404 ||
    code === 20404 ||
    msg.includes('not found') ||
    msg.includes('resource not') ||
    msg.includes('invalid sid') ||
    msg.includes('no such')
  );
}




const fields = [
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 20 },
];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por archivo
  fileFilter: (req, file, cb) => {
    const isMimeOk = /^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype);
    const isExtOk = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    if (isMimeOk && isExtOk) return cb(null, true);
    cb(new Error('Extensión o MIME inválido (solo JPG/PNG/WEBP/GIF)'));
  },
});
const smsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
///END POINTS
// arriba del archivo (donde defines twilio, etc.)
// Ventana de Twilio (≥ 15 min, ≤ 35 días)
const MIN_SCHEDULE_MIN = 16; // dejamos 16 para tener colchón sobre 15
const MAX_SCHEDULE_DAYS = 35;





function clampSendAt(whenISO, tz = "Australia/Sydney") {
  const now = DateTime.now().setZone(tz);
  let target;

  if (typeof whenISO === "string" && whenISO.trim()) {
    target = DateTime.fromISO(whenISO.trim(), { zone: tz });
    if (!target.isValid) {
      // fallback si vino con formato raro
      target = now.plus({ minutes: MIN_SCHEDULE_MIN });
    }
  } else {
    // si no mandan whenISO, por defecto ahora +16 min
    target = now.plus({ minutes: MIN_SCHEDULE_MIN });
  }

  const minAllowed = now.plus({ minutes: MIN_SCHEDULE_MIN });
  const maxAllowed = now.plus({ days: MAX_SCHEDULE_DAYS }).minus({ minutes: 1 });

  let adjusted = false;
  if (target < minAllowed) {
    target = minAllowed;
    adjusted = true;
  }
  if (target > maxAllowed) {
    target = maxAllowed;
    adjusted = true;
  }

  return {
    adjusted,
    localISO: target.toISO(),     // en tz local
    utcISO: target.toUTC().toISO() // Twilio requiere ISO 8601/RFC3339 (UTC recomendado)
  };
}

//  /sendMessageAsk (instantáneo + programado con clamp)
// =====================================================
router.post('/sendMessageAsk', async (req, res) => {
  const MG_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const STATUS_CB = process.env.TWILIO_MESSAGING_STATUS_CALLBACK_URL || ""; // opcional
  console.log("MG_SID:", MG_SID);
  console.log("➡️ req.bodyyyyyyyyyyyyyyyyyyyyyyyyy:", req.body);

  const session = await mongoose.startSession();
    let committed = false;

    try {
      session.startTransaction();

      // #region recepcion + sanitizado
      const { appointmentId } = req.body || {};
      const safeMsg = helpers.sanitizeInput(req.body?.msg);
      const safeAppId = helpers.sanitizeInput(appointmentId);
      // #endregion

      // #region auth y validadores mínimos
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

      const { org_id } = await helpers.getTokenInfo(authHeader);

      if (!safeAppId || !mongoose.Types.ObjectId.isValid(safeAppId)) {
        return res.status(400).json({ error: 'Missing or invalid "safeAppId"' });
      }

      const data = await Appointment.findOne(
        { _id: safeAppId },
        { sid: 1, phoneInput: 1, lastNameInput: 1, nameInput: 1, org_name: 1, org_id: 1, selectedAppDates: 1, representative: 1 }
      );
      if (!data) return res.status(401).json({ error: 'Unknow Patient' });

      const conversationId = data.sid;
      
      // Si el paciente es dependiente (tiene representative.appointment) y no tiene teléfono,
      // buscar el teléfono del representante
      let safeToRaw = helpers.sanitizeInput(data.phoneInput);
      
      if ((!safeToRaw || safeToRaw.trim() === '') && data.representative?.appointment) {
        console.log('📞 Paciente dependiente sin teléfono, buscando teléfono del representante...');
        const representative = await Appointment.findOne(
          { _id: data.representative.appointment },
          { phoneInput: 1, nameInput: 1, lastNameInput: 1 }
        );
        
        if (representative?.phoneInput) {
          safeToRaw = helpers.sanitizeInput(representative.phoneInput);
          console.log(`✅ Usando teléfono del representante: ${representative.nameInput} ${representative.lastNameInput} - ${safeToRaw}`);
        }
      }
      
      if (!safeToRaw || typeof safeToRaw !== 'string' || safeToRaw.trim() === '') {
        return res.status(400).json({ error: 'Missing phone number (patient and representative have no phone)' });
      }

      // E.164 AU
      const { toE164AU } = require('../models/Appointments');
      let safeTo;
      try { safeTo = toE164AU(safeToRaw); } catch { safeTo = safeToRaw; }

      const safeBody = helpers.sanitizeInput(safeMsg);
      if (safeBody && typeof safeBody !== 'string') {
        return res.status(400).json({ error: '"body" must be a string' });
      }
      if (!safeBody?.trim()) {
        return res.status(400).json({ error: 'Message has no Text' });
      }
      // #endregion

      // Branch: programado vs instantáneo
      const scheduleWithTwilio = Boolean(req.body?.scheduleWithTwilio);

      if (scheduleWithTwilio) {
        // ==============================
        // MODO PROGRAMADO (Messaging)
        // ==============================
        if (!MG_SID) return res.status(500).json({ error: "Missing TWILIO_MESSAGING_SERVICE_SID" });

        const tz = typeof req.body?.tz === "string" && req.body.tz.trim()
          ? req.body.tz.trim()
          : "Australia/Sydney";
        const whenISO = typeof req.body?.whenISO === "string" ? req.body.whenISO.trim() : "";

        // Ajuste automático para evitar violaciones de ventana
        const { adjusted, localISO, utcISO } = clampSendAt(whenISO, tz);

        // (Opcional) status callback propio (Messaging API)
        const statusCallback = STATUS_CB
          ? `${STATUS_CB}?org_id=${encodeURIComponent(org_id)}&conversationSid=${encodeURIComponent(conversationId)}`
          : undefined;

        const twScheduled = await client.messages.create({
          to: safeTo,
          messagingServiceSid: MG_SID,  // requerido para scheduling
          body: safeBody,
          scheduleType: "fixed",
          sendAt: utcISO,               // ISO UTC
          ...(statusCallback ? { statusCallback } : {})
        });

        // Placeholder en tu colección Message para el hilo (Conversation UI)
        const docs = {
          user: req.dbUser?._id,
          conversationId,
          proxyAddress: process.env.TWILIO_FROM_MAIN,
          userId: data._id,
          sid: twScheduled.sid,                // SMxxxxxxxx
          author: org_id,
          body: safeBody,
          status: "pending",                   // tu enum no tiene "scheduled"
          direction: "outbound",
          type: MsgType.Confirmation,
          index: makeSyntheticIndex(),
        };

        await Message.findOneAndUpdate(
          { sid: twScheduled.sid },
          { $setOnInsert: docs },
          { upsert: true, new: true }
        );

        await session.commitTransaction(); committed = true;

        console.log("Twilio scheduled message created:", {
          sid: twScheduled.sid,
          sendAtUTC: utcISO,
          localISO,
          adjusted
        });

        return res.status(201).json({
          success: true,
          scheduled: true,
          messagingSid: twScheduled.sid,
          to: safeTo,
          runAt: localISO,   // útil para mostrar en UI en tz local
          tz,
          adjusted,          // true si se movió a +16 min o al máximo permitido
        });
      }

      // ==============================
      // MODO INSTANTÁNEO (Conversations)
      // ==============================
      const groupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Permitir que el frontend indique el slot al que corresponde este envío
      let requestedSlotId = null;
      if (req.body?.slotId && typeof req.body.slotId === 'string' && mongoose.Types.ObjectId.isValid(req.body.slotId)) {
        requestedSlotId = new mongoose.Types.ObjectId(req.body.slotId);
      }

      let twMsg;
      let repairedSid = null;
      try {
        twMsg = await client.conversations.v1
          .conversations(conversationId)
          .messages
          .create({
            author: org_id,
            body: safeBody,
            attributes: JSON.stringify({ groupId, groupIndex: 0, groupCount: 1, user: req.dbUser?._id }),
          });
      } catch (e) {
        if (!isConvSidInvalid(e)) throw e;
        // Autorreparación: crear/obtener conversación por teléfono y reintentar
        const proxy = process.env.TWILIO_FROM_MAIN;
        const newSid = await sms.getOrCreatePhoneConversation({
          client,
          org_id,
          phoneE164: safeTo,
          proxyAddress: proxy,
          meta: { nameInput: data.nameInput, patientId: data._id, org_id },
          createdByUserId: req.dbUser?._id,
        });
        await Appointment.updateOne({ _id: data._id }, { $set: { sid: newSid } });
        repairedSid = newSid;
        twMsg = await client.conversations.v1
          .conversations(newSid)
          .messages
          .create({
            author: org_id,
            body: safeBody,
            attributes: JSON.stringify({ groupId, groupIndex: 0, groupCount: 1, user: req.dbUser?._id, repairedFrom: conversationId }),
          });
      }

      console.log("Twilio creó:", twMsg);

      const docs = {
        user: req.dbUser?._id,
        conversationId: twMsg.conversationSid,
        proxyAddress: process.env.TWILIO_FROM_MAIN,
        userId: data._id,
        sid: twMsg.sid,
        author: org_id,
        body: twMsg.body || "",
        status: "pending",
        direction: "outbound",
        type: MsgType.Confirmation,
        index: twMsg.index,
      };

      try {
        await Message.insertOne(docs);
      } catch (err) {
        console.error("Error saving message to DB:", err);
      }

      // Registrar intento de contacto (ContactAppointment: Pending) y sentAt/askMessageSid en el slot
      try {
        const sentAt = new Date();
        // Elegir slot: preferir el slotId explícito; si no, usar heurística de "último" por fecha
        let latest = null;
        if (requestedSlotId) {
          latest = (data?.selectedAppDates || []).find((s) => String(s?._id) === String(requestedSlotId)) || null;
        }
        if (!latest) {
          const all = Array.isArray(data?.selectedAppDates) ? data.selectedAppDates : [];
          const pendings = all.filter(s => s?.status === 'Pending');
          const pickFrom = pendings.length ? pendings : all;
          const slots = pickFrom
            .map((s) => {
              const t = new Date(
                s?.proposed?.createdAt ||
                s?.updatedAt ||
                s?.proposed?.startDate ||
                s?.startDate || 0
              ).getTime();
              return { slot: s, t };
            })
            .sort((a, b) => b.t - a.t);
          latest = slots.length ? slots[0].slot : null;
        }
  // For the contact attempt, "proposed" should always reflect what we asked the patient:
  // - Prefer explicit slot.proposed.* when present
  // - Otherwise, fall back to the slot's own start/end (the window we are proposing)
  const proposedStartDate = (latest?.proposed?.startDate) || (latest?.startDate) || null;
  const proposedEndDate = (latest?.proposed?.endDate) || (latest?.endDate) || null;
  // Current/actual dates for context (slot top-level)
  const startDate = latest?.startDate || null;
  const endDate = latest?.endDate || null;

        if (latest?._id) {
          await Appointment.updateOne(
            { _id: data._id },
            {
              $set: {
                "selectedAppDates.$[slot].confirmation.sentAt": sentAt,
                "selectedAppDates.$[slot].confirmation.askMessageSid": twMsg.sid,
              },
            },
            { arrayFilters: [{ "slot._id": latest._id }] }
          );
        }

        // Buscar si ya existe un ContactAppointment Pending para este slot (creado por /propose)
        const existingContact = await ContactAppointment.findOne({
          appointment: data._id,
          selectedAppDate: latest?._id,
          status: ContactStatus.Pending,
        }).sort({ createdAt: -1 });

        if (existingContact) {
          // Actualizar el registro existente con los datos del SMS enviado
          await ContactAppointment.updateOne(
            { _id: existingContact._id },
            {
              $set: {
                context: "Confirmation ask",
                askMessageSid: twMsg.sid,
                sentAt,
                // Mantener las fechas propuestas originales si ya existen
                ...(proposedStartDate && !existingContact.proposedStartDate && { proposedStartDate }),
                ...(proposedEndDate && !existingContact.proposedEndDate && { proposedEndDate }),
              },
            }
          );
          console.log(`✅ Updated existing ContactAppointment ${existingContact._id} with SMS info`);
        } else {
          // Solo crear nuevo registro si no existe uno previo para este slot
          await ContactAppointment.create([
            {
              user: req.dbUser?._id,
              org_id,
              appointment: data._id,
              status: ContactStatus.Pending,
              startDate,
              endDate,
              context: "Confirmation ask",
              cSid: twMsg.conversationSid,
              askMessageSid: twMsg.sid,
              sentAt,
              selectedAppDate: latest?._id || null,
              proposedStartDate,
              proposedEndDate,
            },
          ]);
          console.log(`✅ Created new ContactAppointment for slot ${latest?._id}`);
        }
      } catch (e) {
        console.warn("⚠️ Could not create Pending ContactAppointment:", e?.message || e);
      }

      await session.commitTransaction(); committed = true;

      return res.status(200).json({
        success: true,
        scheduled: false,
        docs,
        repairedSid: repairedSid || null,
        previousSid: repairedSid ? conversationId : null,
      });
    } catch (err) {
      if (!committed) {
        try { await session.abortTransaction(); } catch { }
      }
      console.error('❌ Error in /sendMessageAsk:', err?.response?.data || err?.message || err);
      return res.status(500).json({ error: err?.response?.data || err?.message || 'Internal Server Error' });
    } finally {
      session.endSession();
    }

});

// =====================================================
//  POST /appointments/:id/propose
//  Actualiza un slot existente (seleccionado en el modal) con proposed.start/end y lo deja en Pending.
//  Ya NO crea nuevos elementos en selectedAppDates; evita redundancias. Los logs los maneja ContactAppointment en /sendMessageAsk.
// =====================================================
router.post('/appointments/:id/propose', jwtCheck, attachUserInfo, ensureUser, async (req, res) => {
  const session = await mongoose.startSession();
  let committed = false;
  try {
    session.startTransaction();

    const safeId = helpers.sanitizeInput(req.params.id);
    if (!safeId || !mongoose.Types.ObjectId.isValid(safeId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }

  // Body: proposed (obligatorio). current (opcional; si no viene, lo calculamos de último slot)
  // baseSlotId (obligatorio): ID del slot a actualizar (seleccionado en el modal)
    const rawProposedStart = req.body?.proposedStartDate;
    const rawProposedEnd = req.body?.proposedEndDate;
    const rawCurrentStart = req.body?.currentStartDate;
    const rawCurrentEnd = req.body?.currentEndDate;
  const rawBaseSlotId = req.body?.baseSlotId;
    const reason = (req.body?.reason && helpers.sanitizeInput(req.body.reason)) || 'Rebooking';
    const tz = (req.body?.tz && String(req.body.tz)) || 'Australia/Sydney';

    if (!rawProposedStart || !rawProposedEnd) {
      return res.status(400).json({ error: 'Missing proposedStartDate/proposedEndDate' });
    }

    const proposedStartDate = new Date(rawProposedStart);
    const proposedEndDate = new Date(rawProposedEnd);
    if (isNaN(+proposedStartDate) || isNaN(+proposedEndDate)) {
      return res.status(400).json({ error: 'Invalid proposedStartDate/proposedEndDate' });
    }

    // Traer Appointment minimal
    const appt = await Appointment.findOne(
      { _id: safeId },
      { selectedAppDates: 1, sid: 1, org_id: 1 }
    ).session(session);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    // Calcular ventana "current" si no vino desde el cliente
    let currentStartDate;
    let currentEndDate;
    if (rawCurrentStart && rawCurrentEnd) {
      const cs = new Date(rawCurrentStart);
      const ce = new Date(rawCurrentEnd);
      if (!isNaN(+cs) && !isNaN(+ce)) {
        currentStartDate = cs;
        currentEndDate = ce;
      }
    }
    if (!currentStartDate || !currentEndDate) {
      const slots = (appt?.selectedAppDates || [])
        .map((s) => ({ slot: s, t: new Date(s?.proposed?.startDate || s?.startDate || 0).getTime() }))
        .sort((a, b) => b.t - a.t);
      const latest = slots.length ? slots[0].slot : null;
      currentStartDate = latest?.startDate ? new Date(latest.startDate) : proposedStartDate;
      currentEndDate = latest?.endDate ? new Date(latest.endDate) : proposedEndDate;
    }

    const { org_id } = appt;

    // Si mandan baseSlotId válido y existe en el appointment -> actualizarlo
    let targetSlotId = null;
    if (rawBaseSlotId && mongoose.Types.ObjectId.isValid(rawBaseSlotId)) {
      const baseSlot = (appt.selectedAppDates || []).find(s => String(s._id) === String(rawBaseSlotId));
      if (baseSlot) {
        targetSlotId = baseSlot._id;
        // Actualizar proposed del slot existente y fijar origin si aún no existe
        const setDoc = {
          'selectedAppDates.$.proposed.startDate': proposedStartDate,
          'selectedAppDates.$.proposed.endDate': proposedEndDate,
          'selectedAppDates.$.proposed.proposedBy': 'clinic',
          'selectedAppDates.$.proposed.reason': reason,
          'selectedAppDates.$.proposed.createdAt': new Date(),
          'selectedAppDates.$.status': 'Pending',
        };
        if (!baseSlot.origin || !baseSlot.origin.startDate) {
          setDoc['selectedAppDates.$.origin.startDate'] = baseSlot.startDate || currentStartDate;
          setDoc['selectedAppDates.$.origin.endDate'] = baseSlot.endDate || currentEndDate;
          setDoc['selectedAppDates.$.origin.capturedAt'] = new Date();
        }
        await Appointment.updateOne(
          { _id: appt._id, 'selectedAppDates._id': baseSlot._id },
          { $set: setDoc },
          { session }
        );
        await session.commitTransaction(); committed = true;
        return res.status(200).json({
          success: true,
          appointmentId: String(appt._id),
          slotId: String(baseSlot._id),
          updatedExisting: true,
        });
      }
    }
    // Caso SIN baseSlotId: no crear nuevo slot — requerimos selección explícita
    await session.abortTransaction();
    return res.status(400).json({ error: 'baseSlotId is required to rebook an existing date. No new slots are created.' });
  } catch (err) {
    if (!committed) {
      try { await session.abortTransaction(); } catch {}
    }
    console.error('❌ Error in POST /appointments/:id/propose:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  } finally {
    session.endSession();
  }
});


router.post('/sendMessage', jwtCheck, upload.array("files"), async (req, res) => {
 
  // #region recepcion de parámetros
  const session = await mongoose.startSession();
  const { to, body = '', appId } = req.body;
  const files = req.files || [];
 console.log("body", req.body);   // campos de texto
  // #endregion recepcion de parametros
  let committed = false;

  try {
    session.startTransaction();

    // #region sanitizar
    const safeTo = helpers.sanitizeInput(to);
    const safeBody = helpers.sanitizeInput(body);
    const safeAppId = helpers.sanitizeInput(appId);
    // #endregion sanitizar 

    // #region limitadores
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const { org_id } = await helpers.getTokenInfo(authHeader);
    if (!safeAppId || !mongoose.Types.ObjectId.isValid(safeAppId)) {
      return res.status(400).json({ error: 'Missing or invalid "safeAppId"' });
    }

    const data = await Appointment.findOne({ _id: safeAppId }, { sid: 1, phoneInput: 1 })
    if (!data) return res.status(401).json({ error: 'Unknow Patient' });
    const conversationId = data.sid;

    if (!safeTo || typeof safeTo !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "to"' });
    }

    if (safeBody && typeof safeBody !== 'string') {
      return res.status(400).json({ error: '"body" must be a string' });
    }
    if (files.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 files allowed' });
    }
    if (files.some(f => f.size > 10 * 1024 * 1024)) {
      return res.status(400).json({ error: 'Each file must be <= 10MB' });
    }

    if (files.length > 0) {
      for (const file of files) {
        const isMimeOk = /^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype);
        const isExtOk = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
        if (!isMimeOk || !isExtOk) {
          return res.status(400).json({ error: 'Invalid file type (only JPG/PNG/WEBP/GIF allowed)' });
        }

      }
    }
    //#endregion limitadores

    // #region Subir archivos  (REEMPLAZA tu bloque actual)
    const uploadedUrls = [];
    const meSids = [];
    const mediaPublicUrl = [];
    const savedPerFile = []; // útil para DB por mensaje

    for (const file of files) {
      // 1) Subes a tu storage (como ya hacías)
      const key = await aws.uploadFileFromBuffer(file.buffer, org_id, {
        folderName: org_id,
        contentType: file.mimetype,
        originalName: file.originalname,
        fieldName: file.fieldname,
      });

      let signedUrl = null;
      try { signedUrl = await aws.getSignedUrl(key); }
      catch (err) { throw new Error("The URL wasn't signed"); }

      const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

      // 2) Subes el binario ADEMÁS a Twilio MCS y guardas el ME...
      const me = await sms.uploadToMCS(file.buffer, file.originalname, file.mimetype);
      if (!me?.sid) throw new Error("MCS did not return a SID");

      meSids.push(me.sid);
      mediaPublicUrl.push(publicUrl);
      uploadedUrls.push({ url: signedUrl, type: file.mimetype, size: file.size });

      // Para mapear 1 a 1 archivo->mensaje en tu DB
      savedPerFile.push({

        proxyAddress: process.env.TWILIO_FROM_MAIN,
        url: signedUrl,
        signedUrl,
        type: file.mimetype,
        size: file.size,
        filename: file.originalname,
        mediaSid: me.sid,
      });
    }

    console.log("MCS mediaSids:", meSids);
    console.log("mediaPublicUrl (CloudFront):", mediaPublicUrl);
    console.log("uploadedUrls (signed):", uploadedUrls);
    // #endregion Subir archivos

    // #region enviar mensaje a Twilio  (REEMPLAZA tu bloque actual)
    const groupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messagesCreated = [];

    let repairedSid = null;
    const originalSid = conversationId;
    if (meSids.length === 0) {
      // Solo texto
      if (!safeBody?.trim()) {
        return res.status(400).json({ error: 'Message has neither text nor files' });
      }
      try {
        const msg = await client.conversations.v1
          .conversations(conversationId)
          .messages
          .create({
            author: org_id,
            body: safeBody,
            attributes: JSON.stringify({ groupId, groupIndex: 0, groupCount: 1 }),
          });
        messagesCreated.push({ msg, mediaInfo: [] });
      } catch (e) {
        if (!isConvSidInvalid(e)) throw e;
        const proxy = process.env.TWILIO_FROM_MAIN;
        const newSid = await sms.getOrCreatePhoneConversation({
          client,
          org_id,
          phoneE164: safeTo,
          proxyAddress: proxy,
          meta: { patientId: data._id },
          createdByUserId: req.dbUser?._id,
        });
        await Appointment.updateOne({ _id: data._id }, { $set: { sid: newSid } });
        repairedSid = newSid;
        conversationId = newSid; // actualizar para futuros mensajes
        const msg = await client.conversations.v1
          .conversations(newSid)
          .messages
          .create({
            author: org_id,
            body: safeBody,
            attributes: JSON.stringify({ groupId, groupIndex: 0, groupCount: 1, repairedFrom: conversationId }),
          });
        messagesCreated.push({ msg, mediaInfo: [] });
      }
    } else {
      // Varios archivos => N mensajes (uno por ME...)
      for (let i = 0; i < meSids.length; i++) {
        try {
          const msg = await client.conversations.v1
            .conversations(conversationId)
            .messages
            .create({
              author: org_id,
              mediaSid: meSids[i],                // <- CLAVE EN CONVERSATIONS REST
              body: i === 0 ? safeBody || undefined : undefined, // texto solo en el primero (opcional)
              attributes: JSON.stringify({ groupId, groupIndex: i, groupCount: meSids.length }),
            });

          messagesCreated.push({ msg, mediaInfo: [savedPerFile[i]] });
        } catch (e) {
          if (!isConvSidInvalid(e)) throw e;
          const proxy = process.env.TWILIO_FROM_MAIN;
          const newSid = await sms.getOrCreatePhoneConversation({
            client,
            org_id,
            phoneE164: safeTo,
            proxyAddress: proxy,
            meta: { patientId: data._id },
            createdByUserId: req.dbUser?._id,
          });
          await Appointment.updateOne({ _id: data._id }, { $set: { sid: newSid } });
          repairedSid = repairedSid || newSid; // conservar el primero
          conversationId = newSid; // usar nuevo SID para siguientes iteraciones
          const msg = await client.conversations.v1
            .conversations(newSid)
            .messages
            .create({
              author: org_id,
              mediaSid: meSids[i],
              body: i === 0 ? safeBody || undefined : undefined,
              attributes: JSON.stringify({ groupId, groupIndex: i, groupCount: meSids.length, repairedFrom: conversationId }),
            });

          messagesCreated.push({ msg, mediaInfo: [savedPerFile[i]] });
        }
      }
    }

    console.log("Twilio creó:", messagesCreated.map(x => x.msg.sid));
    // #endregion enviar mensaje a Twilio

    // #region Registro en DB  (pequeño ajuste para N mensajes)
    const docs = messagesCreated.map(({ msg, mediaInfo }) => ({
      user: req.dbUser._id,
      conversationId: msg.conversationSid,
      proxyAddress: process.env.TWILIO_FROM_MAIN,
      sid: msg.sid,
      author: org_id,
      body: msg.body || "",
      media: mediaInfo.length ? mediaInfo : [],   // 1 archivo por mensaje
      status: "pending",
      direction: "outbound",
      index: msg.index,          // 👈 clave para orden estable
    }));

    await Message.insertMany(docs);
    // #endregion Registro en DB

    // #region  Enviar a Twilio





    // #ebndregion  Enviar a Twilio


    return res.status(200).json({
      success: true,
      docs,
      repairedSid: repairedSid || null,
      previousSid: repairedSid ? originalSid : null,
    });
  } catch (err) {
    if (!committed) {
      try { await session.abortTransaction(); } catch { }
    }
    console.error('❌ Error in /sendMessage:', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data || err?.message || 'Internal Server Error' });
  } finally {
    session.endSession();
  }
});



router.post("/webhook2", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    console.log("🔍 cleanUrl:", JSON.stringify(url.trim()));

    // ✅ Validar firma Twilio
    const signature = req.headers["x-twilio-signature"];
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body
    );
    if (!valid) {
      console.warn("❌ Firma de Twilio inválida");
      // Si quieres cortar: return res.status(403).json({ error: "Invalid Twilio signature" });
    }

    const payload = req.body;
    console.log("➡️ payload", payload);

    // Obtener binding (número del paciente y proxy de Twilio)
    const { address, proxyAddress } = await getSmsBindingFromWebhookPayload(payload);

    const isInbound = payload.Author && payload.Author.startsWith("+"); // ej: +61...
    const orgId = (process.env.TWILIO_ORG_ID || "").toLowerCase();

    // Upsert mínimo del Appointment si no existe
    await Appointment.updateOne(
      { sid: payload.ConversationSid },
      {
        $setOnInsert: {
          proxyAddress,
          nameInput: payload.Author,
          phoneInput: payload.Author,
          sid: payload.ConversationSid,
          unknown: true,
        },
      },
      { upsert: true }
    );

    // ==================================================================
    // Eventos Twilio
    // ==================================================================
    if (payload.EventType === "onMessageAdded") {
      const now = new Date();
      const status = isInbound ? "sent" : (payload.Status || "pending");


      // 1) Si hay media entrante, súbela a tu storage y obtén URLs firmadas
      const uploadedUrls = [];
      if (isInbound && payload.Media && payload.Media.length > 0) {
        let mediaArray = [];
        if (typeof payload.Media === "string") {
          try {
            mediaArray = JSON.parse(payload.Media);
          } catch (err) {
            console.error("Error al parsear Media:", err);
          }
        } else {
          mediaArray = payload.Media;
        }

        for (const file of mediaArray) {
          const directUrl = await aws.getDirectMediaUrl(payload.ChatServiceSid, file.Sid);
          const key = await aws.uploadImageFromUrl(directUrl, orgId, {
            folderName: orgId,
            contentType: file.mimetype || file.ContentType,
            originalName: file.originalname || file.Filename,
            fieldName: file.fieldname || "media",
          });
          const signedUrl = await aws.getSignedUrl(key);
          uploadedUrls.push({
            url: signedUrl,
            type: file.mimetype || file.ContentType,
            size: file.filesize || file.Size,
          });
        }
      }

      // 2) Guardar el mensaje ANTES de correlacionar
      const updateDoc = {
        conversationId: payload.ConversationSid,
        proxyAddress,
        sid: payload.MessageSid,
        author: payload.Author,
        body: payload.Body ? helpers.sanitizeInput(payload.Body) : "",
        media: uploadedUrls,
        status,
        direction: isInbound ? "inbound" : "outbound",
      };

      // Index numérico si es posible
      const idx =
        typeof payload.Index === "number"
          ? payload.Index
          : parseInt(payload.Index, 10);

      if (!Number.isNaN(idx)) updateDoc.index = idx;

      const saved = await Message.findOneAndUpdate(
        { sid: payload.MessageSid },
        updateDoc,
        { upsert: true, new: true }
      );
      await autoUnarchiveOnInbound(payload.ConversationSid);

      // 3) Correlación SOLO para inbound: ver si responde a la última Confirmation outbound
      if (isInbound) {
        const prev = await findPrevOutboundConfirmation({
          Message,
          conversationId: payload.ConversationSid,
          nowIndex: saved.index,
          nowCreatedAt: saved.createdAt,
        });

        if (prev) {
          const decision = decideFromBody(saved.body || "");
          const lastOutBound = await Message.findOne({ sid: prev.sid });
          const q = await Appointment.findOne({ sid: payload.ConversationSid, unknown: { $ne: true } }, // excluye unknown:true
            { selectedAppDates: 1, nameInput: 1, lastNameInput: 1, org_id: 1 }
          )
          // Enlazar INBOUND -> OUTBOUND y cerrar OUTBOUND
          await Message.updateOne({ sid: saved.sid }, { $set: { respondsTo: prev.sid } });
          await Message.updateOne(
            { sid: prev.sid, $or: [{ resolvedBySid: null }, { resolvedBySid: { $exists: false } }] },
            { $set: { resolvedBySid: saved.sid } }
          );
          // Auto-unarchive
          await autoUnarchiveOnInbound(payload.ConversationSid);

          // Elegir el slot activo dentro de selectedAppDates (array) de forma robusta
          // 1) Intentar por askMessageSid (slot.confirmation.askMessageSid === prev.sid)
          let slotId = (q.selectedAppDates || [])
            .find((s) => String(s?.confirmation?.askMessageSid || '') === String(prev.sid))?._id || null;

          // 2) Intentar por el slot con status Pending más recientemente MODIFICADO (proposed.createdAt / updatedAt)
          if (!slotId) {
            slotId = await pickLastModifiedPendingSlotId({
              Appointment,
              conversationId: payload.ConversationSid,
            });
          }

          // 3) Intentar por ContactAppointment Pending más reciente (con selectedAppDate)
          if (!slotId) {
            const pending = await ContactAppointment.findOne({
              appointment: q._id,
              org_id: q.org_id,
              cSid: payload.ConversationSid,
              status: ContactStatus.Pending,
            }).sort({ createdAt: -1 });
            if (pending?.selectedAppDate) slotId = pending.selectedAppDate;
          }

          // 4) Fallback final: heurística previa
          if (!slotId) {
            slotId = await pickActiveSlotId({
              Appointment,
              conversationId: payload.ConversationSid,
            });
          }

            if (slotId) {
            const arrayFilters = [{ "slot._id": new mongoose.Types.ObjectId(slotId) }];
            if (decision === "confirmed") {
              // Tomar datos del slot real seleccionado; evitar index 0
              const startDate = undefined;
              const endDate = undefined;
              const session = await mongoose.startSession();
              try {
                await session.withTransaction(async () => {
                  // 1) Actualizar el último Pending ContactAppointment (o crear si no existe)
                  // Recalcular start/end basados en el slot confirmado para robustez
                  const confirmedSlot = q.selectedAppDates?.find((s) => String(s._id) === String(slotId)) || null;
                  const slotStart = confirmedSlot?.proposed?.startDate || confirmedSlot?.startDate || null;
                  const slotEnd = confirmedSlot?.proposed?.endDate || confirmedSlot?.endDate || null;

                  await ContactAppointment.findOneAndUpdate(
                    {
                      appointment: q._id,
                      org_id: q.org_id,
                      cSid: payload.ConversationSid,
                      status: ContactStatus.Pending,
                    },
                    {
                      $set: {
                        status: ContactStatus.Confirmed,
                        startDate: slotStart,
                        endDate: slotEnd,
                        selectedAppDate: slotId, // ← garantizar referencia al subdocumento
                        proposedStartDate: confirmedSlot?.proposed?.startDate || slotStart,
                        proposedEndDate: confirmedSlot?.proposed?.endDate || slotEnd,
                        context: "Reschedule confirmation",
                        pSid: payload.ParticipantSid,
                        respondedAt: now,
                        responseMessageSid: payload.MessageSid,
                      },
                      $setOnInsert: { user: prev.user },
                    },
                    { session, upsert: true, new: true, sort: { createdAt: -1 } }
                  );

                  // 2) Actualizar el Appointment y referenciar el contactedId en el slot
                  await Appointment.updateOne(
                    { sid: payload.ConversationSid, unknown: { $ne: true } },
                    {
                      $set: {
                        "selectedAppDates.$[slot].status": ContactStatus.Confirmed,
                        "selectedAppDates.$[slot].rescheduleRequested": false,
                        "selectedAppDates.$[slot].confirmation.decision": "confirmed",
                        "selectedAppDates.$[slot].confirmation.decidedAt": now,
                        "selectedAppDates.$[slot].confirmation.byMessageSid": saved.sid,
                        // Establecer start/end del slot confirmado según la mejor fuente calculada
                        "selectedAppDates.$[slot].startDate": slotStart,
                        "selectedAppDates.$[slot].endDate": slotEnd,
                        // Asegurar que updatedAt del subdocumento refleje el cambio
                        "selectedAppDates.$[slot].updatedAt": now,
                        // Origin snapshot si faltaba (caso legacy)
                        "selectedAppDates.$[slot].origin.startDate": confirmedSlot?.origin?.startDate || slotStart,
                        "selectedAppDates.$[slot].origin.endDate": confirmedSlot?.origin?.endDate || slotEnd,
                        "selectedAppDates.$[slot].origin.capturedAt": confirmedSlot?.origin?.capturedAt || now,
                        reschedule: true,
                      },
                    },
                    { arrayFilters, session, runValidators: true }
                  );
                });
              } finally {
                session.endSession();
              }

                // 3) Si hay un recordatorio pendiente en el slot, programarlo ahora
                try {
                  if (!MG_SID) {
                    console.warn("⚠️ Missing TWILIO_MESSAGING_SERVICE_SID, cannot schedule reminder");
                  } else {
                    // Refrescar el appointment para leer el reminder del slot específico
                    const fresh = await Appointment.findOne(
                      { sid: payload.ConversationSid, unknown: { $ne: true } },
                      { selectedAppDates: 1, phoneInput: 1, org_id: 1, org_name: 1 }
                    ).lean();
                    const slot = fresh?.selectedAppDates?.find((s) => String(s._id) === String(slotId));
                    const reminder = slot?.reminder;
                    if (reminder && !reminder.scheduled && (reminder.msg || '').trim()) {
                      const tz = reminder.tz || "Australia/Sydney";
                      const { adjusted, localISO, utcISO } = clampSendAt(reminder.whenISO || '', tz);

                      // usar el address (tel del paciente) detectado del webhook
                      const toNumber = address;
                      if (toNumber) {
                        const statusCallback = process.env.TWILIO_MESSAGING_STATUS_CALLBACK_URL
                          ? `${process.env.TWILIO_MESSAGING_STATUS_CALLBACK_URL}?org_id=${encodeURIComponent(q.org_id)}&conversationSid=${encodeURIComponent(payload.ConversationSid)}`
                          : undefined;

                        const twScheduled = await client.messages.create({
                          to: toNumber,
                          messagingServiceSid: MG_SID,
                          body: reminder.msg,
                          scheduleType: "fixed",
                          sendAt: utcISO,
                          ...(statusCallback ? { statusCallback } : {})
                        });

                        // Placeholder en mensajes para la UI
                        await Message.findOneAndUpdate(
                          { sid: twScheduled.sid },
                          {
                            $setOnInsert: {
                              user: prev.user,
                              conversationId: payload.ConversationSid,
                              proxyAddress,
                              userId: q._id,
                              sid: twScheduled.sid,
                              author: q.org_id,
                              body: reminder.msg,
                              status: "pending",
                              direction: "outbound",
                              type: MsgType.Message,
                              index: makeSyntheticIndex(),
                            },
                            $set: { status: "pending" },
                          },
                          { upsert: true, new: true }
                        );

                        // Marcar reminder como programado en el slot
                        await Appointment.updateOne(
                          { sid: payload.ConversationSid },
                          {
                            $set: {
                              "selectedAppDates.$[slot].reminder.scheduled": true,
                              "selectedAppDates.$[slot].reminder.scheduledSid": twScheduled.sid,
                              "selectedAppDates.$[slot].reminder.runAtLocal": new Date(localISO),
                              "selectedAppDates.$[slot].reminder.createdBy": req.user?._id || null,
                              "selectedAppDates.$[slot].reminder.createdAt": new Date(),
                            }
                          },
                          { arrayFilters }
                        );

                        // Emitir evento socket para la UI
                        req.io.to(`org:${q.org_id}`).emit("reminderScheduled", {
                          conversationId: payload.ConversationSid,
                          slotId,
                          reminderSid: twScheduled.sid,
                          runAtLocal: localISO,
                          createdBy: req.user?._id || null,
                          createdAt: new Date(),
                        });

                        console.log("📅 Reminder scheduled after confirmation:", {
                          sid: twScheduled.sid,
                          sendAtUTC: utcISO,
                          localISO,
                          adjusted,
                        });
                      }
                    }
                  }
                } catch (e) {
                  console.error("❌ Error scheduling reminder after confirmation:", e?.message || e);
                }
            } else if (decision === "declined") {
              const session = await mongoose.startSession();
              try {
                await session.withTransaction(async () => {
                  // Recalcular datos del slot rechazado
                  const declinedSlot = q.selectedAppDates?.find((s) => String(s._id) === String(slotId)) || null;
                  const dStart = declinedSlot?.proposed?.startDate || declinedSlot?.startDate || null;
                  const dEnd = declinedSlot?.proposed?.endDate || declinedSlot?.endDate || null;

                  await ContactAppointment.findOneAndUpdate(
                    {
                      appointment: q._id,
                      org_id: q.org_id,
                      cSid: payload.ConversationSid,
                      status: ContactStatus.Pending,
                    },
                    {
                      $set: {
                        status: ContactStatus.Rejected,
                        startDate: dStart,
                        endDate: dEnd,
                        selectedAppDate: slotId,
                        proposedStartDate: declinedSlot?.proposed?.startDate || dStart,
                        proposedEndDate: declinedSlot?.proposed?.endDate || dEnd,
                        context: "Reschedule confirmation",
                        pSid: payload.ParticipantSid,
                        respondedAt: now,
                        responseMessageSid: payload.MessageSid,
                      },
                      $setOnInsert: { user: prev.user },
                    },
                    { session, upsert: true, new: true, sort: { createdAt: -1 } }
                  );

                  await Appointment.updateOne(
                    { sid: payload.ConversationSid, unknown: { $ne: true } },
                    {
                      $set: {
                        "selectedAppDates.$[slot].status": ContactStatus.Rejected,
                        "selectedAppDates.$[slot].rescheduleRequested": false,
                        "selectedAppDates.$[slot].confirmation.decision": "declined",
                        "selectedAppDates.$[slot].confirmation.decidedAt": now,
                        "selectedAppDates.$[slot].confirmation.byMessageSid": saved.sid,
                        // ⬇️ Retenemos 'proposed' para histórico, ya no se elimina
                        "selectedAppDates.$[slot].updatedAt": now,
                        "selectedAppDates.$[slot].origin.startDate": declinedSlot?.origin?.startDate || dStart,
                        "selectedAppDates.$[slot].origin.endDate": declinedSlot?.origin?.endDate || dEnd,
                        "selectedAppDates.$[slot].origin.capturedAt": declinedSlot?.origin?.capturedAt || now,
                      },
                    },
                    { arrayFilters }
                  );
                });
              } finally {
                session.endSession();
              }
            }

          }

          // Notificar a la UI con estructura completa del slot y el arreglo actualizado
          queueInvalidate(res, orgId, ["DraggableCards"]);
          let selectedAppDatesFull = [];
          let slotFull = null;
          try {
            const fresh = await Appointment.findOne(
              { sid: payload.ConversationSid, unknown: { $ne: true } },
              { selectedAppDates: 1 }
            ).lean();
            selectedAppDatesFull = Array.isArray(fresh?.selectedAppDates) ? fresh.selectedAppDates : (Array.isArray(q?.selectedAppDates) ? q.selectedAppDates : []);
            if (slotId) {
              slotFull = selectedAppDatesFull.find((s) => String(s?._id) === String(slotId)) || null;
            }
          } catch (e) {
            selectedAppDatesFull = Array.isArray(q?.selectedAppDates) ? q.selectedAppDates : [];
            if (slotId) slotFull = selectedAppDatesFull.find((s) => String(s?._id) === String(slotId)) || null;
          }

          req.io.to(`org:${orgId}`).emit("confirmationResolved", {
            conversationId: payload.ConversationSid,
            respondsTo: prev.sid,
            decision,
            notification: true, // 👈 para que tu frontend lo acepte
            from: payload.Author,
            name: `${q.nameInput} ${q.lastNameInput}`,
            body: decision, // opcional, solo para debug
            date: new Date().toISOString(),
            receivedAt: new Date(),
            appointmentId: String(q._id),
            slotId: slotId ? String(slotId) : null,
            slot: slotFull,
            selectedAppDates: selectedAppDatesFull,
          });
        }

      }

      // 4) Populate user antes de emitir
      const populatedMessage = await Message.findById(saved._id)
        .populate('user', 'name email picture')
        .lean();

      // 5) Emitir el newMessage a la organización
      req.io.to(`org:${orgId}`).emit("newMessage", {
        sid: populatedMessage.sid,
        index: populatedMessage.index,
        conversationId: populatedMessage.conversationId,
        author: populatedMessage.author,
        body: populatedMessage.body,
        media: populatedMessage.media,
        status: populatedMessage.status,
        direction: populatedMessage.direction,
        createdAt: populatedMessage.createdAt,
        updatedAt: populatedMessage.updatedAt,
        user: populatedMessage.user,
      });

      console.log("✅ onMessageAdded →", payload.ConversationSid);
    }

    // ------------------------------------------------------------------



    if (payload.EventType === "onDeliveryUpdated") {
      const updated = await Message.findOneAndUpdate(
        { sid: payload.MessageSid },
        { status: payload.Status },
        { new: true }
      );

      if (updated) {
        req.io.to(`org:${orgId}`).emit("messageUpdated", {
          sid: updated.sid,
          conversationId: updated.conversationId,
          status: updated.status,
        });
        console.log("📤 messageUpdated:", updated.sid, updated.status);

        // (Opcional) reflejar Contacted/Failed en el slot activo
        const slotId = await pickActiveSlotId({
          Appointment,
          conversationId: updated.conversationId,
        });

        if (slotId) {
          const arrayFilters = [{ "slot._id": new mongoose.Types.ObjectId(slotId) }];

          if (updated.status === "failed" || updated.status === "undelivered") {
            await Appointment.updateOne(
              { sid: updated.conversationId },
              { $set: { "selectedAppDates.$[slot].status": "Failed" } },
              { arrayFilters }
            );
          }
        }
      }
    }

    // ------------------------------------------------------------------

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en POST /webhook2:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/webhooks/messaging-status
router.post("/webhooks/messaging-status", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const signature = req.headers["x-twilio-signature"];
    const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, req.body);
    if (!valid) {
      console.warn("❌ Invalid Twilio signature");
      return res.status(403).json({ error: "Invalid Twilio signature" });
    }

    const { MessageSid, MessageStatus, To } = req.body; // SM..., queued|scheduled|sent|delivered|failed|...
    const org_id = String(req.query.org_id || "").toLowerCase();
    const conversationSid = String(req.query.conversationSid || ""); // lo mandamos desde sendMessageAsk

    // Mapeo a tu enum
    const map = {
      queued: "pending",
      accepted: "pending",
      scheduling: "pending",
      scheduled: "pending",
      sending: "pending",
      sent: "sent",
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
      read: "read",
      canceled: "failed", // tu enum no define "canceled"
    };
    const status = map[MessageStatus] || "pending";

    // Actualiza el placeholder (o créalo si no existe)
    const updated = await Message.findOneAndUpdate(
      { sid: MessageSid },
      {
        $set: { status },
        $setOnInsert: {
          conversationId: conversationSid || `PM-${To}`, // fallback
          proxyAddress: process.env.TWILIO_FROM_MAIN,
          sid: MessageSid,
          author: org_id,
          body: "",                // el body no viene en el callback
          direction: "outbound",
          type: MsgType.Message,
          index: makeSyntheticIndex(),
        },
      },
      { upsert: true, new: true }
    );

    // Notifica a tu UI (como ya haces en /webhook2)
    if (req.io) {
      const room = `org:${org_id}`;
      if (conversationSid) {
        req.io.to(room).emit("messageUpdated", {
          sid: updated.sid,
          conversationId: conversationSid,
          status: updated.status,
        });
      } else {
        req.io.to(room).emit("messageUpdated", {
          sid: updated.sid,
          conversationId: updated.conversationId,
          status: updated.status,
        });
      }
    }

    return res.sendStatus(200);
  } catch (e) {
    console.error("❌ messaging-status webhook error:", e);
    return res.sendStatus(500);
  }
});



router.get('/image-meta/:fileId', async (req, res) => {
  const { fileId } = req.params;

  try {
    const metadata = await getFileMetadata(fileId);

    const imageUrl = `${req.protocol}://${req.get('host')}/api/image/${fileId}`;

    res.json({
      ...metadata,
      imageUrl
    });
  } catch (error) {
    console.error('❌ Error en /image-meta:', error.message);
    res.status(500).json({ error: 'No se pudo obtener metadata del archivo' });
  }
});
router.get('/image/:fileId', async (req, res) => {
  const { fileId } = req.params;

  try {
    const fileStream = await streamDriveFile(fileId);

    // Opcional: establecer un tipo MIME genérico o dejar que el navegador lo determine
    res.setHeader('Content-Type', 'image/jpeg'); // puedes usar image/png si sabes el tipo
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache por 1 día

    fileStream
      .on('end', () => console.log(`✅ Imagen enviada: ${fileId}`))
      .on('error', (err) => {
        console.error('❌ Error en el stream:', err.message);
        res.status(500).send('Error al transmitir la imagen');
      })
      .pipe(res);

  } catch (error) {
    console.error('❌ Error en /image:', error.message);
    res.status(500).json({ error: 'No se pudo obtener la imagen' });
  }
});
router.get('/image-link/:fileId', jwtCheck, async (req, res) => {
  const { fileId } = req.params;
  try {
    const url = await getPublicImageLink(fileId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar el link de imagen' });
  }
});
router.post('/upload-file', jwtCheck, upload.fields(fields), async (req, res) => {
  try {
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
    if (!org_id) return res.status(400).json({ success: false, message: 'org_id requerido' });

    // 🔄 aplanar ambos campos a un solo array
    const incoming = [];
    for (const k in (req.files || {})) if (Array.isArray(req.files[k])) incoming.push(...req.files[k]);
    if (!incoming.length) return res.status(400).json({ success: false, message: 'No se recibieron archivos' });

    const { folderName = 'default', category = 'media', sid } = req.body;

    const uploaded = await Promise.all(incoming.map(async (file) => {
      const key = await aws.uploadFileFromBuffer(file.buffer, org_id, {
        folderName,
        contentType: file.mimetype,
        originalName: file.originalname,
        fieldName: file.fieldname,
      });

      let signedUrl = null;
      try { signedUrl = await aws.getSignedUrl(key); } catch { }

      const filename = signedUrl || key;

      await MediaFile.create({
        category,
        filename,
        size: file.size,
        content_type: file.mimetype,
        sid,            // 👈 enlaza con la conversación MMS (opcional)
        org_id,
      });

      return {
        field: file.fieldname,
        originalname: file.originalname,
        size: file.size,
        content_type: file.mimetype,
        key,
        filename,
        category,
        sid,
      };
    }));

    res.json({ success: true, count: uploaded.length, items: uploaded });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed', error: err?.message });
  }
});


// GET /messages/:conversationId/sync
router.get('/messages/:conversationId/sync', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { after, updatedAfter } = req.query;

    let newMessages = [];
    let updatedMessages = [];

    // 🔹 Mensajes nuevos desde la última vez
    if (after) {
      newMessages = await Message.find({
        conversationId,
        createdAt: { $gt: new Date(after) }
      })
      .populate('user', 'name email picture')
      .sort({ createdAt: 1 });
    }

    // 🔹 Mensajes ya existentes pero que cambiaron (ej: status)
    if (updatedAfter) {
      updatedMessages = await Message.find({
        conversationId,
        updatedAt: { $gt: new Date(updatedAfter) }
      })
      .populate('user', 'name email picture')
      .sort({ updatedAt: 1 });
    }

    res.json({ newMessages, updatedMessages });
  } catch (err) {
    console.error("Error sincronizando mensajes:", err);
    res.status(500).json({ error: "No se pudo sincronizar historial" });
  }
});
// GET /messages/:conversationId
router.get('/messages/:conversationId', async (req, res) => {
  try {
    console.log("Entró a /messages/:conversationId")
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 }) // últimos primero
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email picture')
      .lean();

    const ordered = messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );


    const total = await Message.countDocuments({ conversationId });
    console.log("total", total)
    res.json({
      messages: ordered,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + messages.length < total
      }
    });
  } catch (err) {
    console.error("Error cargando historial:", err);
    res.status(500).json({ error: "No se pudo obtener historial" });
  }
});
// GET /conversations
// GET /conversations
// #region Categorías
function escapeRegex(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
router.get('/conversations/search', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const { org_id: rawOrg, sub } = await helpers.getTokenInfo(authHeader);
    const org_id = String(rawOrg || '').toLowerCase();
    const user_id = String(sub || req.user?.id || req.dbUser?._id || '');
    if (!org_id || !user_id) return res.status(400).json({ error: 'Missing org_id or user_id' });

    const fromMain = process.env.TWILIO_FROM_MAIN;
    if (!fromMain) return res.status(500).json({ error: 'TWILIO_FROM_MAIN not configured' });

    const {
      q = '',
      scope = 'active', // 'active' | 'archived' | 'all'
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * pageSize;

    const term = String(q || '').trim();
    const hasSearch = term.length > 0;
    const regex = hasSearch ? new RegExp(escapeRegex(term), 'i') : null;

    // phone digits search (ignore formatting)
    // Improve: allow shorter prefixes (>=3) and handle AU normalization 0xxxx ↔ +61xxxx
    const digits = term.replace(/\D/g, '');
    const phonePatterns = [];
    if (digits.length >= 3) {
      // base pattern as typed (tolerant to separators)
      phonePatterns.push(digits.split('').join('\\D*'));

      // If user typed a local AU number starting with 0 (e.g., 04...), also try +61 without the 0
      if (digits.startsWith('0') && digits.length >= 2) {
        const alt = '61' + digits.slice(1);
        phonePatterns.push(alt.split('').join('\\D*'));
      }

      // If user typed starting with 61 (or +61 in term), also try the local 0-prefixed variant
      if (digits.startsWith('61') && digits.length >= 3) {
        const altLocal = '0' + digits.slice(2);
        phonePatterns.push(altLocal.split('').join('\\D*'));
      }
    }

    const basePipeline = [
      // Limit by Twilio number
      { $match: { proxyAddress: fromMain } },

      // Last message per conversation
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
        },
      },

      // Owner (appointment) limited to org
      {
        $lookup: {
          from: 'appointments',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sid', '$$convId'] },
                    { $eq: [{ $toLower: '$org_id' }, org_id] },
                  ],
                },
              },
            },
            { $sort: { unknown: 1 } }, // prefer known owner
            {
              $group: {
                _id: '$sid',
                doc: { $first: '$$ROOT' },
              },
            },
            { $replaceRoot: { newRoot: '$doc' } },
            {
              $project: {
                _id: 1,
                nameInput: 1,
                lastNameInput: 1,
                phoneInput: 1,
                emailInput: 1,
                org_id: 1,
                color: 1,
                unknown: 1,
              },
            },
          ],
          as: 'appointment',
        },
      },
      { $unwind: '$appointment' },

      // Archived state
      {
        $lookup: {
          from: 'conversation_states',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $eq: [{ $toLower: '$org_id' }, org_id] },
                  ],
                },
              },
            },
            { $project: { archived: 1, archivedAt: 1 } },
          ],
          as: 'stateAgg',
        },
      },
      {
        $addFields: {
          archived: { $ifNull: [{ $first: '$stateAgg.archived' }, false] },
          archivedAt: { $ifNull: [{ $first: '$stateAgg.archivedAt' }, null] },
        },
      },

      // If archived but last inbound is newer than archivedAt => treat as active
      {
        $addFields: {
          archivedEffective: {
            $cond: [
              {
                $and: [
                  { $eq: ['$archived', true] },
                  { $eq: ['$lastMessage.direction', 'inbound'] },
                  { $gt: ['$lastMessage.createdAt', '$archivedAt'] },
                ],
              },
              false,
              '$archived',
            ],
          },
        },
      },

      // Read state for this user
      {
        $lookup: {
          from: 'conversation_reads',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $eq: [{ $toLower: '$org_id' }, org_id] },
                    { $eq: ['$userId', user_id] },
                  ],
                },
              },
            },
            { $project: { lastReadIndex: 1, lastReadAt: 1 } },
          ],
          as: 'readState',
        },
      },
      { $addFields: { readState: { $first: '$readState' } } },

      // Unread count = inbound with index > lastReadIndex
      {
        $lookup: {
          from: 'messages',
          let: {
            convId: '$_id',
            lastIdx: { $ifNull: ['$readState.lastReadIndex', -1] },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $eq: ['$proxyAddress', fromMain] },
                    { $eq: ['$direction', 'inbound'] },
                    { $gt: ['$index', '$$lastIdx'] },
                  ],
                },
              },
            },
            { $count: 'c' },
          ],
          as: 'unreadAgg',
        },
      },
      { $addFields: { unreadCount: { $ifNull: [{ $first: '$unreadAgg.c' }, 0] } } },

      // Text search across owner + lastMessage + conv id
      ...(hasSearch
        ? [{
          $match: {
            $or: [
              { _id: { $regex: regex } }, // conv id partial
              { 'appointment.nameInput': { $regex: regex } },
              { 'appointment.lastNameInput': { $regex: regex } },
              { 'appointment.emailInput': { $regex: regex } },
              { 'lastMessage.body': { $regex: regex } },
              // phone digits tolerant match (supports AU 0xxxxx and +61xxxxx)
              ...(
                phonePatterns.length
                  ? phonePatterns.map((p) => ({ 'appointment.phoneInput': { $regex: new RegExp(p) } }))
                  : []
              ),
            ],
          },
        }]
        : []),

      // Scope
      ...(scope === 'archived'
        ? [{ $match: { archivedEffective: true } }]
        : scope === 'all'
          ? []
          : [{ $match: { archivedEffective: false } }]),

      // Shape
      {
        $project: {
          conversationId: '$_id',
          lastMessage: {
            sid: '$lastMessage.sid',
            conversationId: '$_id',
            body: '$lastMessage.body',
            media: '$lastMessage.media',
            status: '$lastMessage.status',
            direction: '$lastMessage.direction',
            author: '$lastMessage.author',
            proxyAddress: '$lastMessage.proxyAddress',
            createdAt: '$lastMessage.createdAt',
            updatedAt: { $ifNull: ['$lastMessage.updatedAt', '$lastMessage.createdAt'] },
          },
          owner: {
            _id: '$appointment._id',
            name: '$appointment.nameInput',
            lastName: '$appointment.lastNameInput',
            phone: '$appointment.phoneInput',
            email: '$appointment.emailInput',
            org_id: '$appointment.org_id',
            color: '$appointment.color',
            unknown: '$appointment.unknown',
          },
          unreadCount: 1,
          archived: '$archivedEffective',
        },
      },

      // Newest first
      { $sort: { 'lastMessage.createdAt': -1 } },

      // Pagination
      { $skip: skip },
      { $limit: pageSize },
    ];

    const items = await Message.aggregate(basePipeline);

    // hasMore peek
    const peek = await Message.aggregate([
      ...basePipeline.slice(0, -1), // remove $limit
      { $skip: skip + pageSize },
      { $limit: 1 },
    ]);

    res.json({
      items,
      page: pageNum,
      limit: pageSize,
      hasMore: peek.length > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.post('/conversations/:id/archive', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const { org_id, sub } = await helpers.getTokenInfo(authHeader);
    if (!org_id) return res.status(400).json({ error: 'Missing org_id' });

    const conversationId = req.params.id;
    await ConversationState.findOneAndUpdate(
      { org_id, conversationId },
      { $set: { archived: true, archivedAt: new Date(), archivedBy: sub || null } },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Archive failed' });
  }
});

router.post('/conversations/:id/unarchive', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const { org_id } = await helpers.getTokenInfo(authHeader);
    if (!org_id) return res.status(400).json({ error: 'Missing org_id' });

    const conversationId = req.params.id;
    await ConversationState.findOneAndUpdate(
      { org_id, conversationId },
      { $set: { archived: false }, $unset: { archivedAt: 1, archivedBy: 1 } },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Unarchive failed' });
  }
});
// routes/conversations.js (reemplaza el actual GET /conversations por este)
router.get("/conversations", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

    const { org_id, sub } = await helpers.getTokenInfo(authHeader);
    const user_id = String(sub || req.user?.id || req.dbUser?._id || '');
    if (!org_id || !user_id) return res.status(400).json({ error: "Missing org_id or user_id" });

    const fromMain = process.env.TWILIO_FROM_MAIN;
    if (!fromMain) return res.status(500).json({ error: "TWILIO_FROM_MAIN not configured" });

    // filtros de query
    const archivedParam = String(req.query.archived ?? '0'); // '0' | '1' | 'all'
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const basePipeline = [
      { $match: { proxyAddress: fromMain } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
        },
      },
      // appointments
      {
        $lookup: {
          from: 'appointments',
          let: { convId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$sid', '$$convId'] } } },
            { $sort: { unknown: 1 } },
            { $group: { _id: '$sid', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $project: { _id: 1, nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, org_id: 1, color: 1, unknown: 1 } },
          ],
          as: 'appointment',
        },
      },
      { $unwind: '$appointment' },
      // read state por usuario
      {
        $lookup: {
          from: 'conversation_reads',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $eq: ['$org_id', org_id] },
                    { $eq: ['$userId', user_id] },
                  ]
                }
              }
            },
            { $project: { lastReadIndex: 1, lastReadAt: 1 } }
          ],
          as: 'readState',
        },
      },
      { $addFields: { readState: { $first: '$readState' } } },
      // archived state
      {
        $lookup: {
          from: 'conversation_states',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$convId'] },
                    { $eq: ['$org_id', org_id] }
                  ]
                }
              }
            },
            { $project: { archived: 1 } }
          ],
          as: 'stateAgg',
        },
      },
      { $addFields: { archived: { $ifNull: [{ $first: '$stateAgg.archived' }, false] } } },
      // filtro por archived
      ...(archivedParam === 'all' ? [] :
        archivedParam === '1' ? [{ $match: { archived: true } }] :
          [{ $match: { archived: false } }]),
      // ordenar por fecha del último mensaje
      { $sort: { 'lastMessage.createdAt': -1, _id: 1 } },
    ];

    const pipeline = [
      ...basePipeline,
      {
        $facet: {
          // página: aplica skip/limit y calcula unreadCount SOLO para estos
          page: [
            { $skip: skip },
            { $limit: limit },
            // unread por index casteado + fallback por fecha
            {
              $lookup: {
                from: 'messages',
                let: {
                  convId: '$_id',
                  lastIdx: { $ifNull: ['$readState.lastReadIndex', -1] },
                  lastAt: { $ifNull: ['$readState.lastReadAt', new Date(0)] },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$conversationId', '$$convId'] },
                          { $eq: ['$proxyAddress', fromMain] },
                          { $eq: ['$direction', 'inbound'] },
                          {
                            $or: [
                              { $gt: [{ $toInt: { $ifNull: ['$index', -1] } }, '$$lastIdx'] },
                              { $and: [{ $eq: ['$index', null] }, { $gt: ['$createdAt', '$$lastAt'] }] }
                            ]
                          }
                        ],
                      },
                    },
                  },
                  { $count: 'c' },
                ],
                as: 'unreadAgg',
              }
            },
            { $addFields: { unreadCount: { $ifNull: [{ $first: '$unreadAgg.c' }, 0] } } },
            {
              $project: {
                conversationId: '$_id',
                lastMessage: {
                  sid: '$lastMessage.sid',
                  conversationId: '$_id',
                  body: '$lastMessage.body',
                  media: '$lastMessage.media',
                  status: '$lastMessage.status',
                  direction: '$lastMessage.direction',
                  author: '$lastMessage.author',
                  proxyAddress: '$lastMessage.proxyAddress',
                  createdAt: '$lastMessage.createdAt',
                  updatedAt: { $ifNull: ['$lastMessage.updatedAt', '$lastMessage.createdAt'] },
                },
                owner: {
                  _id: '$appointment._id',
                  name: '$appointment.nameInput',
                  lastName: '$appointment.lastNameInput',
                  phone: '$appointment.phoneInput',
                  email: '$appointment.emailInput',
                  org_id: '$appointment.org_id',
                  color: '$appointment.color',
                  unknown: '$appointment.unknown',
                },
                unreadCount: 1,
                archived: 1,
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      },
      {
        $project: {
          items: '$page',
          pagination: {
            page: page,
            limit: limit,
            total: { $ifNull: [{ $first: '$totalCount.count' }, 0] },
            hasMore: {
              $gt: [
                { $ifNull: [{ $first: '$totalCount.count' }, 0] },
                skip + limit
              ]
            }
          }
        }
      }
    ];

    const [result] = await Message.aggregate(pipeline);
    const items = result?.items ?? [];
    const pagination = result?.pagination ?? { page, limit, total: items.length, hasMore: false };

    res.json({ items, pagination });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching conversations" });
  }
});
router.post('/conversations/:id/read', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
    const { org_id, sub } = await helpers.getTokenInfo(authHeader);
    const user_id = String(sub || req.user?.id || req.dbUser?._id || ''); // unificado
    if (!org_id || !user_id) return res.status(400).json({ error: 'Missing org_id or user_id' });

    const fromMain = process.env.TWILIO_FROM_MAIN;
    if (!fromMain) return res.status(500).json({ error: 'TWILIO_FROM_MAIN not configured' });

    const conversationId = req.params.id;

    const latest = await Message.findOne({
      conversationId,
      proxyAddress: fromMain,
    })
      .sort({ index: -1, createdAt: -1 })
      .select({ index: 1, createdAt: 1 })
      .lean();

    const lastReadIndex = typeof latest?.index === 'number'
      ? latest.index
      : (latest?.index != null ? parseInt(String(latest.index), 10) : -1);

    const lastReadAt = latest?.createdAt ?? new Date();

    await ConversationRead.findOneAndUpdate(
      { org_id, conversationId, userId: user_id },
      { $set: { lastReadIndex, lastReadAt } },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, lastReadIndex, lastReadAt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error marking conversation as read' });
  }
});
// #endregion


// combos de middlewares por tipo de endpoint
const { getOrgIdFromRequest } = require("../utils/orgId");
const getOrgId = (req) => req.user?.org_id || req.user?.organization;

function requireOrg(req, res, next) {
  const orgId = getOrgIdFromRequest(req);
  if (!orgId) return res.status(400).json({ error: "Missing org id in token" });
  req.org_id = orgId;               // lo dejas disponible para el resto del handler
  next();
}
const withJwt = [jwtCheck, attachUserInfo];
const withAuth = [jwtCheck, attachUserInfo, ensureUser, syncUserFromToken, requireOrg]; // <-- garantiza req.org_id y sincroniza usuario
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');

// --- Categorías ---


// --- Categorías ---
router.get("/categories", withAuth, async (req, res, next) => {
  try {
    const org_id = req.org_id; // ya lo pone requireOrg
    console.log("org", req.org_id)
    const items = await listChatCategories({ org_id: req.org_id, search: req.query.search });
    res.json(items);
  } catch (e) { next(e); }
});

router.post("/categories", withAuth, async (req, res, next) => {
  try {
    const doc = await createChatCategory({ org_id: req.org_id, data: req.body });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

router.patch("/categories/:id", withAuth, async (req, res, next) => {
  try {
    const allowed = {};
    ["name", "color", "icon", "key", "isActive"].forEach(k => {
      if (req.body[k] !== undefined) allowed[k] = req.body[k];
    });
    const doc = await updateChatCategory({
      org_id: req.org_id,
      chatCategoryId: req.params.id,
      patch: allowed
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) { next(e); }
});

router.post("/conversations/:sid/categories", withAuth, async (req, res, next) => {
  try {
    const { chatCategoryKey, chatCategoryId } = req.body;
    const doc = await assignCategoryToConversation({
      org_id: req.org_id,
      conversationSid: req.params.sid,
      chatCategoryKey,
      chatCategoryId,
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

router.get("/conversations/:sid/categories", withAuth, async (req, res, next) => {
  try {
    const data = await listConversationCategories({
      org_id: req.org_id,
      conversationSid: req.params.sid,
    });
    res.json(data);
  } catch (e) { next(e); }
});

router.delete("/conversations/:sid/categories/:chatCategoryId", withAuth, async (req, res, next) => {
  try {
    const deleted = await unassignCategoryFromConversation({
      org_id: req.org_id,
      conversationSid: req.params.sid,
      chatCategoryId: req.params.chatCategoryId,
    });
    res.json({ deleted });
  } catch (e) { next(e); }
});

// =====================================================
//  POST /simulate/confirmation
//  Emite un evento de socket "confirmationResolved" para probar la UI.
//  Body:
//   - appointmentId?: string
//   - conversationSid?: string
//   - decision?: 'confirmed' | 'declined' | 'reschedule' | 'unknown'
//   - slotId?: string
//   - from?: string
//   - name?: string
//   - body?: string
//   - date?: string (ISO o cualquier string para mostrar en el toast)
// =====================================================
router.post('/simulate/confirmation', withAuth, async (req, res) => {
  try {
    const {
      appointmentId,
      conversationSid,
      decision: rawDecision = 'confirmed',
      slotId,
      from: fromOverride,
      name: nameOverride,
      body: bodyOverride,
      date: dateOverride,
    } = req.body || {};

    const allowed = new Set(['confirmed', 'declined', 'reschedule', 'unknown']);
    const decision = allowed.has(String(rawDecision)) ? String(rawDecision) : 'confirmed';

    if (!appointmentId && !conversationSid) {
      return res.status(400).json({ error: 'Provide appointmentId or conversationSid' });
    }

    let appt = null;
    if (appointmentId && mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      appt = await Appointment.findOne(
        { _id: appointmentId },
        { sid: 1, phoneInput: 1, phoneE164: 1, proxyAddress: 1, nameInput: 1, lastNameInput: 1, org_id: 1, selectedAppDates: 1 }
      ).lean();
    }
    if (!appt && conversationSid) {
      appt = await Appointment.findOne(
        { sid: String(conversationSid) },
        { sid: 1, phoneInput: 1, phoneE164: 1, proxyAddress: 1, nameInput: 1, lastNameInput: 1, org_id: 1, selectedAppDates: 1 }
      ).lean();
    }
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const convId = String(appt.sid || conversationSid || '');
    const orgId = String(appt.org_id || req.org_id || '').toLowerCase();

    const allSlots = Array.isArray(appt.selectedAppDates) ? appt.selectedAppDates : [];
    let chosenSlot = null;
    if (slotId && mongoose.Types.ObjectId.isValid(String(slotId))) {
      chosenSlot = allSlots.find((s) => String(s?._id) === String(slotId)) || null;
    }
    if (!chosenSlot) {
      // Heurística: slot más "reciente" por updatedAt/proposed.createdAt/startDate
      const withTs = allSlots.map((s) => {
        const t = new Date(
          s?.updatedAt || s?.proposed?.createdAt || s?.proposed?.startDate || s?.startDate || 0
        ).getTime();
        return { s, t };
      });
      withTs.sort((a, b) => b.t - a.t);
      chosenSlot = withTs.length ? withTs[0].s : null;
    }

    const from = fromOverride || appt.phoneInput || appt.phoneE164 || appt.proxyAddress || '';
    const name = nameOverride || `${appt.nameInput || ''} ${appt.lastNameInput || ''}`.trim();
    const dateStr = dateOverride || (chosenSlot?.startDate ? new Date(chosenSlot.startDate).toISOString() : new Date().toISOString());

    // Antes de emitir el socket, aplicar la actualización solicitada en MongoDB
    // Nota: se aplica al appointment encontrado (equivalente a usar el _id específico del ejemplo)
    try {
      await Appointment.updateOne(
        { _id: appt._id },
        { $set: { "selectedAppDates.0.status": "Confirmed" } }
      );
    } catch (e) {
      console.warn("⚠️ /simulate/confirmation: no se pudo actualizar selectedAppDates.0.status:", e?.message || e);
    }

    const payload = {
      conversationId: convId,
      respondsTo: null,
      decision,
      notification: true,
      from,
      name,
      body: bodyOverride || decision,
      date: dateStr,
      receivedAt: new Date(),
      appointmentId: String(appt._id),
      slotId: chosenSlot?._id ? String(chosenSlot._id) : null,
      slot: chosenSlot || null,
      selectedAppDates: allSlots,
    };

    if (orgId) {
      req.io.to(`org:${orgId}`).emit('confirmationResolved', payload);
    } else {
      // Fallback: emitir globalmente si no hay org (no debería ocurrir)
      req.io.emit('confirmationResolved', payload);
    }

    return res.json({ ok: true, emitted: payload });
  } catch (e) {
    console.error('❌ Error in /simulate/confirmation:', e?.message || e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================================================
//  GET /conversations/health
//  Lista chats (appointments) y valida el SID en Twilio (paginado)
//  Query:
//    - page: number (default 1)
//    - limit: number (default 50, max 200)
//    - validate: '0' | '1' (default '1') — si '1', consulta Twilio para cada SID
// =====================================================
router.get('/conversations/health', [...withAuth, requireAnyPermissionExplain('master')], async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limitReq = Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1);
    const limit = Math.min(limitReq, 200);
  const validate = String(req.query.validate ?? '1') === '1';
  const skip = (page - 1) * limit;
  const q = String(req.query.q ?? '').trim();

    const orgLower = String(req.org_id || '').toLowerCase();
    // Aggregate appointments by org, newest first
    const base = [
      {
        $match: {
          $expr: {
            $eq: [{ $toLower: '$org_id' }, orgLower],
          },
        },
      },
      {
        $project: {
          _id: 1,
          nameInput: 1,
          lastNameInput: 1,
          phoneInput: 1,
          emailInput: 1,
          sid: 1,
          unknown: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { updatedAt: -1, _id: 1 } },
    ];

    const searchStage = q
      ? {
          $match: {
            $or: [
              { nameInput: { $regex: q, $options: 'i' } },
              { lastNameInput: { $regex: q, $options: 'i' } },
              { phoneInput: { $regex: q, $options: 'i' } },
              { emailInput: { $regex: q, $options: 'i' } },
            ],
          },
        }
      : null;

    const pipeline = [
      ...base,
      ...(searchStage ? [searchStage] : []),
      {
        $facet: {
          page: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          items: '$page',
          total: { $ifNull: [{ $first: '$totalCount.count' }, 0] },
        },
      },
    ];

    const [result] = await Appointment.aggregate(pipeline);
    let items = Array.isArray(result?.items) ? result.items : [];
    let total = Number(result?.total || 0);
    // Fallback: si no hay appointments por org, intentar a partir de mensajes (conversations activas)
    if (total === 0 && !q) {
      const fromMain = process.env.TWILIO_FROM_MAIN;
      const basePipeline = [
        ...(fromMain ? [{ $match: { proxyAddress: fromMain } }] : []),
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$conversationId', lastMessage: { $first: '$$ROOT' } } },
        {
          $lookup: {
            from: 'appointments',
            let: { convId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$sid', '$$convId'] },
                      { $eq: [{ $toLower: '$org_id' }, orgLower] },
                    ],
                  },
                },
              },
              { $sort: { unknown: 1 } },
              { $group: { _id: '$sid', doc: { $first: '$$ROOT' } } },
              { $replaceRoot: { newRoot: '$doc' } },
              { $project: { _id: 1, nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, sid: 1, unknown: 1, createdAt: 1, updatedAt: 1 } },
            ],
            as: 'appointment',
          },
        },
        { $unwind: '$appointment' },
        { $sort: { 'lastMessage.createdAt': -1, _id: 1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      const fallback = await Message.aggregate(basePipeline);
      items = fallback.map((row) => row.appointment);
      total = items.length; // aproximado para fallback; si quieres exacto, podemos agregar $facet
    }

    let enriched = items.map((it) => ({
      appointmentId: String(it._id),
      name: it.nameInput || '',
      lastName: it.lastNameInput || '',
      phone: it.phoneInput || '',
      email: it.emailInput || '',
      sid: it.sid || '',
      unknown: !!it.unknown,
      status: it.sid ? 'unchecked' : 'missing',
      reason: it.sid ? undefined : 'No SID present',
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    if (validate) {
      enriched = await Promise.all(
        enriched.map(async (row) => {
          if (!row.sid) return row; // missing already set
          const r = await validateConversationSid(client, row.sid);
          return { ...row, status: r.status, reason: r.reason };
        })
      );
    }
    console.log({enriched,
      pagination: {
        page,
        limit,
        total,
        hasMore: total > 0 ? (skip + items.length < total) : false,
      },
    })
    res.json({
      items: enriched,
      pagination: {
        page,
        limit,
        total,
        hasMore: total > 0 ? (skip + items.length < total) : false,
      },
    });
  } catch (e) {
    console.error('❌ Error in GET /conversations/health:', e?.message || e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================================================
//  POST /conversations/health/:appointmentId/repair
//  Repara (crea o reemplaza) la conversación Twilio para un paciente con SID missing/invalid/error.
//  Devuelve la fila de health actualizada.
// =====================================================
router.post('/conversations/health/:appointmentId/repair', [...withAuth, requireAnyPermissionExplain('master')], async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      return res.status(400).json({ error: 'Invalid appointmentId' });
    }
    const orgLower = String(req.org_id || '').toLowerCase();
    const appt = await Appointment.findOne({ _id: appointmentId }).lean();
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    if (String(appt.org_id || '').toLowerCase() !== orgLower) {
      return res.status(403).json({ error: 'Forbidden (org mismatch)' });
    }

    let currentSid = appt.sid || '';
    let status = 'missing';
    let reason = 'No SID present';

    if (currentSid) {
      const r = await validateConversationSid(client, currentSid);
      status = r.status;
      reason = r.reason;
    }

    // Si SID ok y usuario pide reparar -> no hacemos nada especial
    if (status === 'ok') {
      return res.json({
        item: {
          appointmentId: String(appt._id),
          name: appt.nameInput || '',
          lastName: appt.lastNameInput || '',
          phone: appt.phoneInput || '',
          email: appt.emailInput || '',
          sid: currentSid,
          unknown: !!appt.unknown,
          status: 'ok',
          reason,
          createdAt: appt.createdAt,
          updatedAt: appt.updatedAt,
        },
        repaired: false,
      });
    }

    // Política solicitada: NO reparar casos "missing" (sin SID) — debe gestionarse por otro flujo.
    if (status === 'missing') {
      return res.status(400).json({ error: 'Repair not allowed for missing SID (no conversation).', status, reason });
    }

    // Solo reparar invalid / error.
    if (status !== 'invalid' && status !== 'error') {
      return res.status(400).json({ error: `Repair not applicable for status '${status}'.` });
    }

    // Crear nueva conversación Twilio
    let newConv = null;
    try {
      newConv = await client.conversations.v1.conversations.create({
        friendlyName: `${appt.nameInput || 'Appointment'}-${appt._id}`.slice(0, 100),
        messagingServiceSid: MG_SID || undefined,
      });
    } catch (twErr) {
      console.error('❌ Error creando conversación Twilio:', twErr?.message || twErr);
      return res.status(502).json({ error: 'Twilio conversation create failed', detail: twErr?.message });
    }

    const newSid = newConv.sid;
    await Appointment.updateOne(
      { _id: appt._id },
      { $set: { sid: newSid } }
    );

    const updated = await Appointment.findOne({ _id: appt._id }, { sid: 1, nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, unknown: 1, createdAt: 1, updatedAt: 1 }).lean();
    return res.json({
      item: {
        appointmentId: String(updated._id),
        name: updated.nameInput || '',
        lastName: updated.lastNameInput || '',
        phone: updated.phoneInput || '',
        email: updated.emailInput || '',
        sid: updated.sid || '',
        unknown: !!updated.unknown,
        status: 'ok',
        reason: 'Repaired (new conversation created)',
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      repaired: true,
      previousSid: currentSid || null,
    });
  } catch (e) {
    console.error('❌ Error in POST /conversations/health/:appointmentId/repair:', e?.message || e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// =====================================================
//  POST /conversations/health/repair-all
//  Repara en lote todos los appointments con SID missing o invalid (revalida antes de crear).
//  Devuelve resumen + items reparados.
// =====================================================
router.post('/conversations/health/repair-all', [...withAuth, requireAnyPermissionExplain('master')], async (req, res) => {
  try {
    const orgLower = String(req.org_id || '').toLowerCase();
    // Traer todos los appointments de la org
    const appts = await Appointment.find({ org_id: new RegExp(`^${orgLower}$`, 'i') }, { sid: 1, nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, unknown: 1, createdAt: 1, updatedAt: 1 }).lean();

    const toRepair = [];
    for (const appt of appts) {
      const sid = appt.sid || '';
      // Política: ignorar missing (no crear SID en bulk) y solo reparar invalid
      if (!sid) continue; // missing se salta
      const r = await validateConversationSid(client, sid);
      if (r.status === 'invalid') {
        toRepair.push({ appt, reason: r.reason || r.status });
      }
    }

    const repairedItems = [];
    for (const entry of toRepair) {
      const { appt } = entry;
      let newConv = null;
      try {
        newConv = await client.conversations.v1.conversations.create({
          friendlyName: `${appt.nameInput || 'Appointment'}-${appt._id}`.slice(0, 100),
          messagingServiceSid: MG_SID || undefined,
        });
      } catch (twErr) {
        console.error('❌ Bulk repair Twilio error:', twErr?.message || twErr);
        repairedItems.push({
          appointmentId: String(appt._id),
          name: appt.nameInput || '',
          lastName: appt.lastNameInput || '',
          phone: appt.phoneInput || '',
          email: appt.emailInput || '',
          sid: appt.sid || '',
          unknown: !!appt.unknown,
          status: 'error',
          reason: `Create failed: ${twErr?.message || 'Unknown'}`,
          createdAt: appt.createdAt,
          updatedAt: appt.updatedAt,
          repaired: false,
        });
        continue;
      }
      const newSid = newConv.sid;
      await Appointment.updateOne({ _id: appt._id }, { $set: { sid: newSid } });
      const updated = await Appointment.findOne({ _id: appt._id }, { sid: 1, nameInput: 1, lastNameInput: 1, phoneInput: 1, emailInput: 1, unknown: 1, createdAt: 1, updatedAt: 1 }).lean();
      repairedItems.push({
        appointmentId: String(updated._id),
        name: updated.nameInput || '',
        lastName: updated.lastNameInput || '',
        phone: updated.phoneInput || '',
        email: updated.emailInput || '',
        sid: updated.sid || '',
        unknown: !!updated.unknown,
        status: 'ok',
        reason: 'Repaired (new conversation created)',
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        repaired: true,
        previousSid: appt.sid || null,
      });
    }

    res.json({
      processed: appts.length,
      attempted: toRepair.length,
      repaired: repairedItems.filter(x => x.repaired).length,
      failed: repairedItems.filter(x => x.status === 'error').length,
      items: repairedItems,
    });
  } catch (e) {
    console.error('❌ Error in POST /conversations/health/repair-all:', e?.message || e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
