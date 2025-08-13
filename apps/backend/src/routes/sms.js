const express = require('express');
const path = require('path');

const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { ContactStatus } = require("../constants")
const DOMPurify = require('isomorphic-dompurify');
const { Appointment, MessageLog, MediaFile } = require('../models/Appointments');
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
//router.use(attachUserInfo); // /send
const smsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
const { receiveMessage } = require('../controllers/message.controller');
const Appointments = require('../models/Appointments');
// Sanitización de entrada
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return DOMPurify.sanitize(input.trim());
}




router.post('/sms', (req, res) => {
  console.log("📩 MENSAJE RECIBIDO DESDE TWILIO");
  res.set('Content-Type', 'text/xml');
  res.status(200).send('<Response></Response>');
});

router.get('/test-socket', jwtCheck, (req, res) => {
  const fakeMessage = {
    from: '+61412345678',
    body: 'yes',
    notification: true,
    receivedAt: new Date()
  };

  const orgRoom = `${"Iconic Smiles".toLowerCase().replace(/\s+/g, '_')}`;
  console.log("Room desde sms", orgRoom)
  req.io.to(orgRoom).emit('smsReceived', fakeMessage); // ✅ Enavía al room específico

  console.log("📡 Emitido:", fakeMessage);
  res.send({ fakeMessage });
});
router.get('/send-sms', async (req, res) => {

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





router.post('/send-sms', async (req, res) => {
  const { appointmentId } = req.body;
  console.log("HA llegado un mensaje a send-sms")
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








const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const BASE_URL = process.env.BASE_URL;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

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




router.post('/sending-sms', jwtCheck, async (req, res) => {
  const session = await mongoose.startSession();
  let committed = false;

  try {
    session.startTransaction();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);
    const { to, body, appId } = req.body;
    console.log("to", to, "body", body, "appId", appId, "org_id", org_id)
    const { sid: conversationSid } = await Appointment.findOne({ _id: appId, org_id }, { sid: 1 })
    console.log("Este es el rey de los sid:", conversationSid)
    if (typeof to !== 'string' || typeof body !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing "to" or "body"' });
    }

    if (!appId || typeof appId !== 'string' || !mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ error: 'Missing or invalid "appId" field' });
    }

    await client.conversations.v1
      .conversations(conversationSid)
      .messages
      .create({
        author: org_id.toLowerCase(),
        body: body,
      });

    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appId },
      { $set: { lastMessage: new Date() } },
      { new: true, session }
    );

    if (!updatedAppointment) {
      throw new Error(`Appointment not found for ID: ${appId}`);
    }

    await session.commitTransaction();
    committed = true;

    res.status(200).json({
      success: true,
      sid: conversationSid,
      to,
      body,
      appId,
    });

  } catch (err) {
    if (!committed) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.warn("⚠️ Error al abortar la transacción:", abortErr.message);
      }
    }
    console.error("❌ Error in /sending-sms:", err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  } finally {
    session.endSession();
  }
});


const storage = multer.memoryStorage();

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


// ✅ Acepta 1 archivo (file) o varios (files)
const fields = [
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 20 },
];
router.post('/send-message', jwtCheck, upload.array('files'), async (req, res) => {
  const session = await mongoose.startSession();
  let committed = false;

  try {
    session.startTransaction();

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const { org_id } = await helpers.getTokenInfo(authHeader);

    const { to, body = '', appId } = req.body;
    const files = req.files || [];

    if (!appId || !mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({ error: 'Missing or invalid "appId"' });
    }
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "to"' });
    }

    const hasText = !!body.trim();
    const hasFiles = files.length > 0;

    // Regla: O texto O archivos (no ambos)
    if ((hasText && hasFiles) || (!hasText && !hasFiles)) {
      return res.status(400).json({ error: 'Send either text OR files, not both (and not neither).' });
    }

    // Obtener conversación (CH...) desde la cita
    const appt = await Appointment.findOne({ _id: appId }, { sid: 1 }).lean();
    if (!appt?.sid) return res.status(404).json({ error: 'Conversation SID not found for appointment' });
    const conversationSid = appt.sid;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_CONVERSATIONS_SERVICE_SID;
    console.log("accountSid", accountSid, "authToken", authToken, "serviceSid", serviceSid)

    // Helper: subir un archivo a MCS → devuelve mediaSid (ME...)
    async function uploadToMCS(fileBuffer, filename, contentType) {
      const mcsUrl = `https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media`;
      console.log(mcsUrl)
      const resp = await axios.post(mcsUrl, fileBuffer, {
        auth: { username: accountSid, password: authToken },
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
          'X-Twilio-Filename': filename || 'file',
        },
      });
      return resp?.data?.sid; // ME...
    }

    // Enviar mensaje a Conversations (texto o media)
    const convMsgUrl = `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;

    let mediaSids = [];
    if (hasFiles) {
      // Subir todos los archivos a MCS
      for (const f of files) {
        const meSid = await uploadToMCS(f.buffer, f.originalname, f.mimetype);
        if (meSid) mediaSids.push(meSid);
      }
      // Crear mensaje con 1..N MediaSid (sin body)
      const form = new URLSearchParams();
      form.set('Author', String(org_id).toLowerCase());
      for (const me of mediaSids) form.append('MediaSid', me);



      const serviceSid = await getServiceSidForConversation(conversationSid);

      const Resp = await axios.post(convMsgUrl, form, {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const received = {
        body: {
          ...Resp.data, // <= PascalCase
          ChatServiceSid: serviceSid
        }
      }


      await helpers.loadImage(received, org_id);

    } else {
      // Solo texto
      const form = new URLSearchParams();
      form.set('Author', String(org_id).toLowerCase());
      form.set('Body', body.trim());



      const serviceSid = await getServiceSidForConversation(conversationSid);

      const Resp = await axios.post(convMsgUrl, form, {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const received = {
        body: {
          ...Resp.data, // <= PascalCase
          ChatServiceSid: serviceSid
        }
      }

      await helpers.loadImage(received, org_id);
    }

    // Actualizar lastMessage
    await Appointment.findByIdAndUpdate(appId, { $set: { lastMessage: new Date() } }, { session });

    await session.commitTransaction();
    committed = true;

    return res.status(200).json({
      success: true,
      conversationSid,
      mediaSids, // vacío si fue texto
    });
  } catch (err) {
    if (!committed) {
      try { await session.abortTransaction(); } catch { }
    }
    console.error('❌ Error in /send-message:', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data || err?.message || 'Internal Server Error' });
  } finally {
    session.endSession();
  }
});

router.post('/testreq', async (req, res, next) => {
  let mediaSids = [];
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const { org_id } = await helpers.getTokenInfo(authHeader);

  const appt = await Appointment.findOne({ _id: "6893189412ccc563dbe6fee7" }, { sid: 1 }).lean();
  if (!appt?.sid) return res.status(404).json({ error: 'Conversation SID not found for appointment' });
  const conversationSid = appt.sid;
  // Crear mensaje con 1..N MediaSid (sin body)
  const form = new URLSearchParams();
  form.set('Author', String(org_id).toLowerCase());
  for (const me of mediaSids) form.append('MediaSid', me);

  const convMsgUrl = `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;

  const serviceSid = await sms.getServiceSidForConversation(conversationSid);
  console.log("serviceSid", serviceSid, "conversationSid", conversationSid, convMsgUrl)

  const Resp = await axios.post(convMsgUrl, form, {
    auth: { username: accountSid, password: authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  console.log(req.body, "req.body")

  const received = {
    body: {
      ...Resp.data, // <= PascalCase
      ChatServiceSid: serviceSid
    }
  }
  console.log("convMsgUrl ", convMsgUrl)
  console.log(received, "answer")
  // Inyecta ChatServiceSid al objeto antes de normalizar


  await helpers.loadImage(received, org_id);
}
)


router.post('/webhook2', express.urlencoded({ extended: false }), async (req, res, next) => {
  const { source } = req.body;
  console.log(TWILIO_AUTH_TOKEN, BASE_URL)
  try {
    // ✅ Si es FRONTEND, requiere autenticación con jwtCheck
    if (source === 'frontend') {
      jwtCheck(req, res, async (err) => {
        if (err) {
          console.warn('⛔ JWT invalid:', err.message);
          return res.status(401).json({ error: 'Unauthorized frontend request' });
        }

        const { appointmentId } = req.body;
        if (!appointmentId) {
          return res.status(400).json({ error: 'appointmentId es requerido' });
        }

        console.log('📲 Request recibido desde el FRONTEND');
        await sms.main(appointmentId, req);
        return res.status(200).json({ success: true });
      });
    }

    // ✅ Si viene de Twilio (sin token), procesa directamente
    else {
      // ✅ TWILIO → Validar X-Twilio-Signature
      const signature = req.headers['x-twilio-signature'];
      const url = `${BASE_URL}/webhook2`; // Debe ser la URL EXACTA registrada en Twilio
      console.log("url", url)
      const valid = twilio.validateRequest(
        TWILIO_AUTH_TOKEN,
        signature,
        url,
        req.body
      );

      /*if (!valid) {
        console.warn('❌ Firma de Twilio inválida');
        return res.status(403).json({ error: 'Invalid Twilio signature' });
      }*/

      console.log('📩 Request recibido desde TWILIO');

      const { Author, ConversationSid } = req.body;
      if (!ConversationSid) {
        return res.status(400).json({ error: 'Missing ConversationSid from Twilio' });
      }

      const localPhone = sms.convertToLocalMobile(Author);
      const appointment = await Appointment.findOne(
        { phoneInput: localPhone },
        {
          _id: 1,
          phoneInput: 1,
          nameInput: 1,
          lastNameInput: 1,
          selectedAppDates: 1, // trae el arreglo completo
          org_id: 1,
          lastMessageInteraction: 1,
          lastMessage: 1,
          sid: 1
        }
      );

      if (!appointment) {
        return res.status(400).json({ error: 'No appointments for this user' });
      }
      await Appointment.updateOne({ _id: appointment._id },
        { $set: { lastMessage: new Date() }, },
      );
      const idString = appointment._id.toString();
      console.log("appointment", appointment)
      const isConfirmation = await sms.isThisSMSaConfirmation(req, appointment)
      console.log(isConfirmation ? "Es una confirmación" : "no es una confirmación")
      if (isConfirmation) { // Se pasa al sistema de confirmación de citas
        await sms.main(idString, req);
      }
      else { //El mensaje se envia directamente por socket

        if (
          Array.isArray(appointment.selectedAppDates) &&
          appointment.selectedAppDates.length > 0 &&
          appointment.selectedAppDates[0].status === ContactStatus.Pending
        ) {
          await Appointment.updateOne(
            { _id: appointment._id },
            { $set: { "selectedAppDates.0.status": ContactStatus.Rejected } },
          );
        }

        await helpers.refreshSocketObject(appointment, req)
      }
      return res.status(200).json({ success: true });
    }

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



module.exports = router;
