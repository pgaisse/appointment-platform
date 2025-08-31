const express = require('express');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { ContactStatus } = require("../constants")
const DOMPurify = require('isomorphic-dompurify');
const { Appointment, MessageLog, MediaFile, Message } = require('../models/Appointments');
const sms = require('../helpers/conversations')
const helpers = require('../helpers');
const multer = require("multer");
const aws = require('../helpers/aws');
const twilio = require('twilio');
const router = express.Router();
const mongoose = require('mongoose');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, verifyJwtManually } = require('../middleware/auth');
const { SendMessageSchema } = require("../schemas/messages");
const { uploadImageFromUrl, getFileMetadata, getPublicImageLink } = require('../helpers/imagesManagment')
const { receiveMessage } = require('../controllers/message.controller');
const Appointments = require('../models/Appointments');
const {
  listChatCategories,
  createChatCategory,
  updateChatCategory,
  assignCategoryToConversation,
  listConversationCategories,
  unassignCategoryFromConversation,
} = require("../models/Chat/chatCategorizationService");


const storage = multer.memoryStorage();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID;
const client = twilio(accountSid, authToken);





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


router.get('/sendSms', async (req, res) => {

  const appointmentId = '6879e8e61cebb27de2734d0c';

  // 🔍 Validación de entrada
  if (!appointmentId) {
    return res.status(400).json({ error: 'Missing required field: appointmentId' });
  }

  try {
    // 🟢 Intentar enviar el SMS
    await sms.main(appointmentId, req.io);

    // ✅ Éxito
    return res.status(200).json({ success: true, message: 'SMS sent successfully', appointmentId });

  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
})
router.post('/sendSms', async (req, res) => {
  const { appointmentId } = req.body;
  // 🔍 Validación de entrada
  if (!appointmentId) {
    return res.status(400).json({ error: 'Missing required field: appointmentId' });
  }

  try {
    // 🟢 Intentar enviar el SMS
    await sms.main(appointmentId, req.io);

    // ✅ Éxito
    return res.status(200).json({ success: true, message: 'SMS sent successfully' });

  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
});
router.get('/getchats', jwtCheck, async (req, res) => {
  try {
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    const appointments = await Appointment.find(
      { org_id, lastMessage: { $exists: true, $ne: null } },
      { nameInput: 1, lastNameInput: 1, phoneInput: 1, sid: 1, lastMessage: 1 }
    )
      .sort({ lastMessage: -1 })
      .limit(5);

    const allMessagesPerContact = (
      await Promise.all(
        appointments.map(async (item) => {
          if (!item.sid) return null;

          try {
            const [convo, messages] = await Promise.all([
              client.conversations.v1.conversations(item.sid).fetch(),
              client.conversations.v1.conversations(item.sid).messages.list({
                limit: 100,
                order: 'desc',
              }),
            ]);

            if (!messages.length) return null;

            const chatMessages = await Promise.all(
              messages.map(async (msg) => {
                const uploadedMediaObjects = [];

                // Si tiene media, la buscamos en Mongo
                if (Array.isArray(msg.media) && msg.media.length > 0) {
                  await Promise.all(
                    msg.media.map(async (media) => {
                      const result = await MediaFile.find({ sid: media.sid });
                      if (result.length > 0) uploadedMediaObjects.push(...result);
                    })
                  );
                }

                return {
                  sid: item.sid,
                  nextToken: '',
                  name: `${item.nameInput || ''} ${item.lastNameInput ?? ''}`.trim(),
                  phone: item.phoneInput,
                  author: (msg.author || '').toLowerCase().replace(/\s+/g, '_'),
                  body: msg.body || '',
                  avatar: undefined,
                  dateCreated: msg.dateCreated || convo.dateCreated,
                  appId: item._id,
                  messageSid: msg.sid,
                  media: uploadedMediaObjects, // vacío si no hay media
                };
              })
            );

            return {
              name: `${item.nameInput || ''} ${item.lastNameInput ?? ''}`.trim(),
              lastmessage: item.lastMessage,
              chatmessage: chatMessages.reverse(),
              appId: item._id,
            };
          } catch (innerErr) {
            console.warn(`⚠️ No se pudo procesar conversación con SID ${item.sid}:`, innerErr.message);
            return null;
          }
        })
      )
    ).filter(Boolean);

    allMessagesPerContact.sort(
      (a, b) => new Date(b.lastmessage) - new Date(a.lastmessage)
    );

    res.status(200).json(allMessagesPerContact);
  } catch (err) {
    console.error('❌ Error en /getchats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/sendMessage', jwtCheck, upload.array("files"), async (req, res) => {
  console.log("➡️ req.body:", req.body);   // campos de texto
  console.log("➡️ req.files:", req.files); // array de archivos enviados
  // #region recepcion de parámetros
  const session = await mongoose.startSession();
  const { to, body = '', appId } = req.body;
  const files = req.files || [];

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

    if (meSids.length === 0) {
      // Solo texto
      if (!safeBody?.trim()) {
        return res.status(400).json({ error: 'Message has neither text nor files' });
      }
      const msg = await client.conversations.v1
        .conversations(conversationId)
        .messages
        .create({
          author: org_id,
          body: safeBody,
          attributes: JSON.stringify({ groupId, groupIndex: 0, groupCount: 1 }),
        });
      messagesCreated.push({ msg, mediaInfo: [] });
    } else {
      // Varios archivos => N mensajes (uno por ME...)
      for (let i = 0; i < meSids.length; i++) {
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
      }
    }

    console.log("Twilio creó:", messagesCreated.map(x => x.msg.sid));
    // #endregion enviar mensaje a Twilio

    // #region Registro en DB  (pequeño ajuste para N mensajes)
    const docs = messagesCreated.map(({ msg, mediaInfo }) => ({
      conversationId: msg.conversationSid,
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



router.post('/webhook2', express.urlencoded({ extended: false }), async (req, res, next) => {
  try {

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const cleanUrl = url.trim();  // quita espacios ocultos
    console.log("🔍 cleanUrl:", JSON.stringify(cleanUrl));


    // ✅ TWILIO → Validar X-Twilio-Signature
    const signature = req.headers['x-twilio-signature'];
    const valid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body
    );

    if (!valid) {
      console.warn('❌ Firma de Twilio inválida');
      // return res.status(403).json({ error: 'Invalid Twilio signature' });
    }

    const payload = req.body;
    console.log("se entró")
    console.log("payload", payload)
    const isInbound = payload.Author && payload.Author.startsWith("+"); // ej: +61, +56, etc.
    //obtener org_id
    const data = await Appointment.updateOne(
      { sid: payload.ConversationSid },
      {
        $setOnInsert:
        {
          nameInput: payload.Author,
          phoneInput: payload.Author,
          sid: payload.ConversationSid,
          unknown: true,
        }
      },

      { upsert: true }

    )
    const org_id = process.env.TWILIO_ORG_ID;
    const orgId = org_id.toLowerCase()


    // #region Gestion de estado de mensajes
    if (payload.EventType === "onMessageAdded") {
      const status = isInbound ? "sent" : (payload.Status || "pending");

      // #region de existir media, subirla a la cloud y obtener la url
      const uploadedUrls = [];


      if (isInbound && payload.Media && payload.Media.length > 0) {

        if (typeof payload.Media === "string") {
          try {
            mediaArray = JSON.parse(payload.Media); // lo convierte en array de objetos
          } catch (err) {
            console.error("Error al parsear Media:", err);
          }
        } else {
          mediaArray = payload.Media; // ya es array
        }
        console.log("payload.Media", mediaArray)
        for (const file of mediaArray) {
          const url = await aws.getDirectMediaUrl(payload.ChatServiceSid, file.Sid)
          console.log("url---------------------------------->", url, org_id)
          const key = await aws.uploadImageFromUrl(url, org_id, {
            folderName: org_id,
            contentType: file.mimetype,
            originalName: file.originalname,
            fieldName: file.fieldname,
          });
          console.log("key---------------------------------->", key, org_id)
          let signedUrl = null;
          try {
            signedUrl = await aws.getSignedUrl(key);
            console.log("signedUrl---------------------->", signedUrl)
          }
          catch (err) {
            console.log(err)
            throw new Error("The URL wasn't signed", err)

          }
          uploadedUrls.push({ url: signedUrl, type: file.mimetype, size: file.filesize });
        }

      }


      // #endregion
      // 🔹 Mensaje nuevo confirmado en Twilio
      const saved = await Message.findOneAndUpdate(
        { sid: payload.MessageSid },
        {
          conversationId: payload.ConversationSid,
          sid: payload.MessageSid,
          author: payload.Author,
          body: payload.Body ? helpers.sanitizeInput(payload.Body) : "",
          media: uploadedUrls || [],
          status: status,
          index: payload.index,          // 👈 clave para orden estable
          direction: isInbound ? "inbound" : "outbound"
        },
        { upsert: true, new: true } // inserta si no existe
      );
      console.log("saved", saved)
      req.io.to(orgId).emit("newMessage", {
        sid: saved.sid,
        index: payload.index,
        conversationId: saved.conversationId,
        author: saved.author,
        body: saved.body,
        media: saved.media,
        status: saved.status,
        direction: saved.direction,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      console.log("y con un payload.conversationId= ", payload.ConversationSid)
    }


    if (payload.EventType === "onDeliveryUpdated") {
      const status = payload.Status;

      const updated = await Message.findOneAndUpdate(
        { sid: payload.MessageSid },
        { status },
        { new: true }
      );
      if (updated) {
        req.io.to(orgId).emit("messageUpdated", {
          sid: updated.sid,
          conversationId: updated.conversationId, // 👈 NECESARIO
          status: updated.status,
        });

        console.log("📤 Emitido messageUpdated:", updated.sid, updated.status);
      }
    }
    //emmpujar socket


    // #endregion

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en POST /webhook2:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
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
      }).sort({ createdAt: 1 });
    }

    // 🔹 Mensajes ya existentes pero que cambiaron (ej: status)
    if (updatedAfter) {
      updatedMessages = await Message.find({
        conversationId,
        updatedAt: { $gt: new Date(updatedAfter) }
      }).sort({ updatedAt: 1 });
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
      .limit(limit)
      .lean();

    const ordered = messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );


    const total = await Message.countDocuments({ conversationId });
    console.log("total", total)
    res.json({
      messages,
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
router.get("/conversations", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

    const { org_id } = await helpers.getTokenInfo(authHeader);
    if (!org_id) return res.status(400).json({ error: "No org_id found in request" });

    const conversations = await Message.aggregate([
      // 1) Tomamos el último mensaje por conversación
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
        },
      },

      // 2) Join con appointments para datos del owner y filtrar por organización
      {
        $lookup: {
          from: "appointments",
          localField: "_id",     // conversationId
          foreignField: "sid",   // Appointment.sid
          as: "appointment",
        },
      },
      { $unwind: "$appointment" },
      //{ $match: { "appointment.org_id": org_id } },

      // 3) Proyección: lastMessage completo (coincide con tipo Message del front)
      {
        $project: {
          conversationId: "$_id",
          lastMessage: {
            sid: "$lastMessage.sid",
            conversationId: "$_id",                // 👈 necesario en el front
            body: "$lastMessage.body",
            media: "$lastMessage.media",
            status: "$lastMessage.status",
            direction: "$lastMessage.direction",    // 👈 necesario en el front
            author: "$lastMessage.author",
            createdAt: "$lastMessage.createdAt",
            updatedAt: {                            // 👈 fallback por si falta
              $ifNull: ["$lastMessage.updatedAt", "$lastMessage.createdAt"],
            },
          },
          owner: {
            _id: "$appointment._id",
            name: "$appointment.nameInput",
            lastName: "$appointment.lastNameInput",
            phone: "$appointment.phoneInput",
            email: "$appointment.emailInput",
            org_id: "$appointment.org_id",
            unknown: "$appointment.unknown",
          },
        },
      },

      // (opcional) volver a ordenar por el tiempo del último mensaje
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching conversations" });
  }
});



/* --- Categorías --- */
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
const withAuth = [jwtCheck, attachUserInfo, requireOrg]; // <-- garantiza req.org_id

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

module.exports = router;
