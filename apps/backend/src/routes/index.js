const express = require('express');
const router = express.Router();
const helpers = require('../helpers');
const { Appointment, Categories, PriorityList, ManualContact } = require('../models/Appointments');
//const { GoogleGenerativeAI } = require("@google/generative-ai");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken, ensureUser } = require('../middleware/auth');
const models = require("../models/Appointments");
const sms = require('../helpers/conversations')
const { findMatchingAppointments } = require('../helpers/findMatchingAppointments');
dayjs.extend(utc);
dayjs.extend(timezone);
const mongoose = require("mongoose");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { findConversationByPhoneTwilioOnly } = require("../helpers/findConversationByPhoneSafely");
const PhoneConversationLink = require('../models/PhoneConversationLink');
const DOMPurify = require('isomorphic-dompurify');
const { exist } = require('joi');





//RUTAS PROTEGIDAS
router.use(jwtCheck, attachUserInfo, ensureUser);





router.get('/', jwtCheck, (req, res) => {
  res.json({ mensaje: "este es el mensaje lbablabla" });
});





router.post('/', jwtCheck, async (req, res) => {

  try {
    const { org_id, sub } = await helpers.getTokenInfo(req.headers.authorization)
    const obj = req.body;
    const color = helpers.getColor();
    obj.color = color
    obj.org_id = org_id
    obj.user_id = sub
    let newAppointment;
    switch (obj.model) {
      case "Categories":
        obj.id = Number(Number(await Categories.countDocuments()) + 1);

        newAppointment = new Categories(obj)
        break;
      case "Appointment":
        obj.id = Number(Number(await Categories.countDocuments()) + 1);
        newAppointment = new Appointment(obj)
        break;
    }



    await newAppointment.save();

    res.json({});

  }
  catch (err) {
    console.log(err)
  }
});

router.get('/appointments', jwtCheck, async (req, res) => {
  try {

    //const decoded = jwt.decode(, { complete: true });

    const { org_id } = await helpers.getTokenInfo(req.headers.authorization)
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // convierte domingo (0) en 7
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);
    const appointmentsList = await Appointment.find({
      org_id,
      "selectedAppDates.startDate": { $gte: startOfWeek },
      "selectedAppDates.endDate": { $lte: twoWeeksLater }
    });





    res.json([{ appointmentsList, start: startOfWeek, end: twoWeeksLater }]);

  }
  catch (err) {
    console.log(err)

  }
});

router.get('/appointmentsgeneralview', jwtCheck, async (req, res) => {
  try {

    //const decoded = jwt.decode(, { complete: true });

    const { org_id } = await helpers.getTokenInfo(req.headers.authorization)
    const appointmentsList = await Appointment.find({ org_id })


    res.json(appointmentsList);

  }
  catch (err) {
    console.log(err)

  }
});

router.get('/categories', jwtCheck, async (req, res) => {
  try {


    const { org_id } = await helpers.getTokenInfo(req.headers.authorization)


    const categoriesList = await Categories.find({ org_id }).sort({ id: 1 });


    res.json(categoriesList);

  }
  catch (err) {
    console.log(err)

  }
});

router.get('/treatments', jwtCheck, async (req, res) => {
  const { org_id } = await helpers.getTokenInfo(req.headers.authorization)
  try {
    //pendiente de individualizar según empresa

    const priorityList = await PriorityList.find({
      organization: org_id
    })

    //const priorityList = helpers.priorityList();

    res.json(priorityList);

  }
  catch (err) {
    console.log(err)

  }
});

// routes/query.js (handler drop-in)
router.get('/query/:collection', jwtCheck, async (req, res) => {
  try {
    console.log(req.user)
    const { collection } = req.params;
    const Model = models[collection];
    if (!Model) return res.status(400).json({ error: 'Invalid collection name' });

    // 🔐 org_id desde token (se mantiene)
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    // --- helpers locales, no rompen nada ---
    const tryParseJSON = (v) => {
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch { return undefined; }
    };
    const normalizeSelect = (sel) => {
      if (!sel) return undefined;
      const parsed = tryParseJSON(sel);
      if (Array.isArray(parsed)) return parsed.join(' ');
      return String(sel).replace(/\+/g, ' ');
    };

    // --- filtros (igual que antes, pero con parseo seguro) ---
    let filters = {};
    if (req.query.query) {
      const parsed = tryParseJSON(req.query.query);
      if (!parsed) return res.status(400).json({ error: "Bad JSON in 'query'" });
      filters = parsed;

      if (req.query.convertObjectId === 'true') {
        try {
          filters = convertIdsInFilter(filters);
        } catch {
          return res.status(400).json({ error: 'convertObjectId failed' });
        }
      }
    }

    // ⬅️ Mantengo enforcement de org_id
    filters.org_id = org_id;

    // --- projection / select (projection ya existía; select es opcional) ---
    let projection = {};
    if (req.query.projection) {
      const parsed = tryParseJSON(req.query.projection);
      if (!parsed) return res.status(400).json({ error: "Bad JSON in 'projection'" });
      projection = parsed;
    }
    const selectStr = normalizeSelect(req.query.select); // opcional, no rompe

    // --- populate (tolerante a errores) ---
    let populate = [];
    if (req.query.populate) {
      const parsed = tryParseJSON(req.query.populate);
      if (!parsed) return res.status(400).json({ error: "Bad JSON in 'populate'" });
      populate = Array.isArray(parsed) ? parsed : [parsed];
    }

    // --- limit (igual que antes) ---
    let limit = 50;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsedLimit)) limit = parsedLimit;
    }
    //console.log(filters, projection, selectStr, populate, limit)
    // --- construir query (retrocompatible) ---
    let query = Model.find(filters, projection);

    if (selectStr) {
      // select es adicional; si no lo usas, no afecta
      query = query.select(selectStr);
    }

    if (populate && Array.isArray(populate)) {
      for (const p of populate) {
        try {
          if (!p) continue;
          if (typeof p === 'string') {
            query = query.populate(p);
          } else if (p && typeof p === 'object') {
            // ✅ pasa el objeto completo (soporta anidados sin perder opciones)
            query = query.populate(p);
          }
        } catch (e) {
          // 👇 Evita 500 si un path no es ref válido (solo loggea y sigue)
          console.warn('⚠️ populate skipped:', p, e?.message);
        }
      }
    }

    query = query.limit(limit);
    //console.log("filters", filters, Model.collection.name)
    const result = await query.lean();
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error fetching collection:', {
      message: error.message,
      stack: error.stack,
      params: req.params,
      query: req.query,
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/appointments/exists', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const valid = ids.filter((x) => mongoose.isValidObjectId(x));
  if (!valid.length) return res.json({ exists: {} });

  const rows = await Appointment.find({ _id: { $in: valid } })
    .select('_id')
    .lean();
  const set = new Set(rows.map((r) => String(r._id)));
  const map = Object.fromEntries(valid.map((id) => [id, set.has(id)]));
  return res.json({ exists: map });
});

router.patch("/update-items", jwtCheck, async (req, res) => {
  const { org_id, sub } = await helpers.getTokenInfo(req.headers.authorization);
 console.log("BodySE entró aupdate_______________________", req.body)
  const updates = Array.isArray(req.body) ? req.body : [req.body];
  const results = [];

  try {
    for (const update of updates) {
      const { table, id_field, id_value } = update;
      let { data } = update;

      if (!table || !id_field || !id_value || !data) {
        results.push({
          status: "failed",
          update,
          reason: "Missing required fields",
        });
        continue;
      }

      const Model = models[table];
      if (!Model) {
        results.push({
          status: "failed",
          update,
          reason: `Model "${table}" not found`,
        });
        continue;
      }

      // Forzamos unknown=false y no confiamos en org_id del cliente
      data = { ...data, unknown: data.unknown ? data.unknown : false };
      if (org_id) {
        // Si no viene org_id en el doc, lo agregamos con el del token
        // (No sobreescribimos si ya existe en el payload; lo añade solo si falta)
        if (data.org_id == null) data.org_id = org_id;
      }

      // Filtro seguro por organización:
      // - Si el doc ya tiene org_id, debe coincidir con el del token.
      // - Si el doc no tiene org_id, permitimos la actualización y le añadimos org_id.
      const filter = org_id
        ? {
          [id_field]: id_value,
          $or: [
            { org_id: { $exists: false }, proxyAddress: process.env.TWILIO_FROM_MAIN },
            { org_id, proxyAddress: process.env.TWILIO_FROM_MAIN },
          ],
        }
        : { [id_field]: id_value };
        console.log("----------------------------------------------->",filter, data)
      const updatedDoc = await Model.findOneAndUpdate(
        filter,
        { $set: data },
        { new: true }
      );

      if (!updatedDoc) {
        results.push({
          status: "failed",
          id: id_value,
          reason: "Document not found or not accessible for this organization",
        });
      } else {
        results.push({ status: "success", id: id_value });
      }
    }

    const allSuccessful = results.every((r) => r.status === "success");
    const responseCode = allSuccessful ? 200 : 207;

    return res.status(responseCode).json({
      message: allSuccessful ? "All updates applied" : "Some updates failed",
      results,
    });
  } catch (err) {
    console.error("❌ Critical error in /update-items:", err.stack || err);
    return res.status(500).json({
      error: "Critical failure while processing update-items",
      details: err.message,
    });
  }
});



function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}



router.get('/DraggableCards', jwtCheck, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const { org_id, token } = await helpers.getTokenInfo(authHeader);
    console.log("Token", token);
    if (!org_id) {
      return res.status(403).json({ error: 'Unauthorized: org_id not found' });
    }

    const { start, end } = helpers.getDateRange();
    if (!start || !end) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const result = await models.PriorityList.aggregate([
      { $match: { org_id } },
      {
        $lookup: {
          from: 'appointments',
          let: {
            durationHours: '$durationHours',
            priorityNum: '$id',
            priorityId: '$_id',
            priorityName: '$name',
            priorityColor: '$color',
            priorityDescription: '$description',
            priorityNotes: '$notes'
          },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$priority', '$$priorityId'] },
                org_id: org_id,
                selectedAppDates: {
                  $elemMatch: {
                    startDate: { $gte: start },
                    endDate: { $lte: end },
                  },
                },
              },
            },
            // ⬇️ Excluir SOLO position == -1 (acepta nulos/ausentes y strings)
            {
              $match: {
                $expr: {
                  $ne: [
                    { $convert: { input: "$position", to: "double", onError: null, onNull: null } },
                    -1
                  ]
                }
              }
            },

            { $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'timeblocks',
                localField: 'selectedDates.days.timeBlocks',
                foreignField: '_id',
                as: 'selectedDates.days.timeBlocks',
              },
            },
            {
              $lookup: {
                from: 'messagelogs',
                localField: '_id',
                foreignField: 'appointment',
                as: 'contactMessages',
              },
            },
            {
              $group: {
                _id: "$_id",
                nameInput: { $first: "$nameInput" },
                emailInput: { $first: "$emailInput" },
                phoneInput: { $first: "$phoneInput" },
                lastNameInput: { $first: "$lastNameInput" },
                textAreaInput: { $first: "$textAreaInput" },
                priority: { $first: "$priority" },
                note: { $first: "$note" },
                color: { $first: "$color" },
                user_id: { $first: "$user_id" },
                org_id: { $first: "$org_id" },
                treatment: { $first: "$treatment" },
                contactMessages: { $first: "$contactMessages" },
                position: { $first: "$position" },
                reschedule: { $first: "$reschedule" },
                selectedStartDate: { $first: "$selectedDates.startDate" },
                selectedEndDate: { $first: "$selectedDates.endDate" },
                days: { $push: "$selectedDates.days" },
                selectedAppDates: { $first: "$selectedAppDates" },
              },
            },
            {
              $lookup: {
                from: 'treatments',
                localField: 'treatment',
                foreignField: '_id',
                as: 'treatment',
              },
            },
            {
              $unwind: {
                path: '$treatment',
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                selectedDates: {
                  startDate: "$selectedStartDate",
                  endDate: "$selectedEndDate",
                  days: "$days",
                },
                priority: {
                  durationHours: "$$durationHours",
                  description: "$$priorityDescription",
                  notes: "$$priorityNotes",
                  id: "$$priorityNum",
                  _id: "$$priorityId",
                  name: "$$priorityName",
                  color: "$$priorityColor",
                }
              },
            },
            {
              $project: {
                selectedStartDate: 0,
                selectedEndDate: 0
              },
            },
          ],
          as: 'patients',
        },
      },
      {
        $project: {
          _id: 1,
          priorityNum: "$id",
          priorityId: "$_id",
          priorityName: "$name",
          priorityColor: "$color",
          description: 1,
          durationHours: 1,
          priority: {
            org_id: "$org_id",
            id: "$id",
            _id: "$_id",
            description: "$description",
            notes: "$notes",
            durationHours: "$durationHours",
            name: "$name",
            color: "$color"
          },
          count: { $size: "$patients" },
          patients: 1,
        },
      },
    ]);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[GET /DraggableCards] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/add', jwtCheck, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header provided' });

    const { org_id, sub, org_name } = await helpers.getTokenInfo(authHeader);
    const orgName = helpers.cleanOrgName(org_name);
    if (!org_id) return res.status(400).json({ error: 'org_id not found in token' });

    const { modelName, data } = req.body;
    if (!modelName || typeof modelName !== 'string')
      return res.status(400).json({ error: 'modelName is required and must be a string' });
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return res.status(400).json({ error: 'data must be a valid object' });
    if (!req.dbUser?._id)
      return res.status(401).json({ error: 'User not resolved (ensureUser did not attach req.dbUser)' });

    const proxyAddress = process.env.TWILIO_FROM_MAIN;
    let sid;

    if (modelName === models.Appointment.modelName) {
      const phoneE164 = helpers.localToE164AU(data.phoneInput);

      // 1) Busca/crea conv. singleton en Twilio (idempotente)
      const meta = {
        phone: data.phoneInput,
        nameInput: data.nameInput,
        patientId: data?.nameInput?._id,
        org_id,
      };

      sid = await sms.getOrCreatePhoneConversation({
        client, org_id, phoneE164, proxyAddress, meta, createdByUserId: req.dbUser._id,
      });

      // 2) Upsert en enlace DB con índice único
      await PhoneConversationLink.findOneAndUpdate(
        { org_id, phoneE164 },
        { conversationSid: sid, proxyAddress },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      // 3) (Opcional) sincroniza en Appointment
      await models.Appointment.updateMany(
        { org_id, phoneInput: phoneE164 },
        { $set: { conversationSid: sid, proxyAddress, user: req.dbUser._id } }
      );
    }

    // Data enriquecida para el doc a crear
    const enrichedData = {
      ...data,
      org_id,
      ...(sid && { sid }),
      ...(proxyAddress && { proxyAddress }),
      lastMessage: new Date(),
      unknown: false,
      org_name: orgName,
      createdBy: sub,
      createdAt: new Date(),
      user: req.dbUser._id,
    };

    const Model = models[modelName] || mongoose.model(
      modelName,
      new mongoose.Schema({}, { strict: false, collection: modelName })
    );

    const savedDoc = await new Model(enrichedData).save();
    return res.status(201).json({ message: 'Document created successfully', document: savedDoc });

  } catch (error) {
    // Si el error es por índice único (conflicto DB), vuelve a leer el SID y reintenta
    if (error?.code === 11000) {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization);
      const phoneE164 = helpers.localToE164AU(req.body?.data?.phoneInput);
      const link = await PhoneConversationLink.findOne({ org_id, phoneE164 });
      return res.status(200).json({
        message: 'Document created with existing conversation (deduped)',
        conversationSid: link?.conversationSid || null,
      });
    }
    console.error('[POST /add] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});






const clamp = (n, min, max) =>
  Math.max(min, Math.min(parseInt(n, 10) || 0, max));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /appointments/mentions?nameInput=<q>&limit=5&mode=contains
 * Devuelve hasta `limit` coincidencias para sugerir menciones tras '#'.
 */
router.get('/appointments/mentions', jwtCheck, async (req, res) => {
  console.log(req.query)
  try {
    let { nameInput = '', limit = '5', mode = 'contains' } = req.query;
    console.log("nameInput", nameInput)
    const q = String(nameInput).trim();
    const lim = clamp(limit, 1, 8);
    if (!q) return res.json({ items: [] });

    const re =
      mode === 'prefix'
        ? new RegExp('^' + escapeRegex(q), 'i')
        : new RegExp(escapeRegex(q), 'i');

    // (Opcional) limitar por organización desde el token
    let org_id;
    try {
      const info = await helpers.getTokenInfo(req.headers.authorization);
      org_id = info?.org_id;
    } catch (_) { }

    const match = { nameInput: re };
    if (org_id) match.org_id = org_id;

    const pipeline = [
      { $match: match },
      { $set: { __q: q.toLowerCase() } },
      { $addFields: { __idx: { $indexOfCP: [{ $toLower: '$nameInput' }, '$__q'] } } },
      { $addFields: { __starts: { $eq: ['$__idx', 0] } } },
      { $sort: { __starts: -1, __idx: 1, updatedAt: -1, createdAt: -1 } },
      { $limit: lim },
      {
        $project: {
          _id: 1,
          nameInput: 1,
          avatarUrl: 1,
          phoneInput: 1,
          emailInput: 1,
          type: { $literal: 'appointment' },
        }
      },
      // Si prefieres limpiar los auxiliares explícitamente:
      // { $unset: ['__q','__idx','__starts'] },
    ];

    const items = await Appointment.aggregate(pipeline).exec();
    return res.json({ items });
  } catch (err) {
    console.error('GET /appointments/mentions error', err);
    return res.status(500).send('Internal error');
  }
});



router.delete("/:id", jwtCheck, async (req, res) => {
  try {
    const authHeader = await req.headers.authorization;
    const { modelName } = req.body;
    const { id } = req.params;

    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header missing" });
    }

    const { org_id } = await helpers.getTokenInfo(authHeader);
    if (!org_id) {
      return res.status(403).json({ error: "org_id not found in token" });
    }

    if (!modelName || typeof modelName !== "string") {
      return res.status(400).json({ error: "modelName is required in request body" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    const Model = models[modelName];
    if (!Model) {
      return res.status(404).json({ error: `Model "${modelName}" not found` });
    }

    // 🔐 Buscar y eliminar el documento sólo si coincide con el org_id
    const deletedDoc = await Model.findOneAndDelete({ _id: id, org_id });

    if (!deletedDoc) {
      return res.status(404).json({ error: "Document not found or not authorized" });
    }

    return res.status(200).json({
      message: "Document deleted successfully",
      deletedId: id,
    });
  } catch (err) {
    console.error("[DELETE /delete/:id] Error:", err.stack || err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message,
    });
  }
});


router.get('/sorting', jwtCheck, async (req, res) => {
  try {
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization)

    let { startDate, endDate, category } = req.query
    startDate = new Date(startDate);
    endDate = new Date(endDate);

    // 🔎 Ver qué viene en el request

    // Ejecutar lógica
    const result = await findMatchingAppointments(startDate, endDate);

    // 🔎 Ver qué devuelve tu función

    res.json([result]);
  }
  catch (err) {
    console.error("❌ Error en /sorting:", err);
    res.status(500).json({ error: err.message || "Error interno" });
  }
});


router.put('/edit/:id', jwtCheck, async (req, res) => {
  const { id } = req.params;
  const updatedData = { ...req.body };
  const model = req.headers["x-model"]; // recibir model desde header

  // Eliminar _id si viene en updatedData para evitar error en reemplazo
  if (updatedData._id) delete updatedData._id;

  let updatedItem;
  try {
    switch (model) {
      case "Categories":
        updatedItem = await Categories.findOneAndReplace(
          { _id: id },
          updatedData,
          { returnDocument: 'after' } // devuelve el documento actualizado
        );
        break;
      case "Appointment":
        updatedItem = await Appointment.findOneAndReplace(
          { _id: id },
          updatedData,
          { returnDocument: 'after' }
        );
        break;
      default:
        return res.status(400).json({ message: 'Model not supported' });
    }

    if (!updatedItem) return res.status(404).json({ message: 'Item not found' });
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
});


router.put('/categoriesid', jwtCheck, async (req, res) => {
  const updates = req.body; // [{ _id, id }, ...]

  try {
    const results = await Promise.all(
      updates.map(({ _id, id }) => {
        return Categories.findByIdAndUpdate(_id, { id }, { new: true });
      })
    );

    res.json(results);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error updating categories', error });
  }
});

router.put('/appointmentsid', jwtCheck, async (req, res) => {
  const updates = req.body; // Array de objetos con _id, position, textAreaInput


  try {
    const results = await Promise.all(
      updates.map(({ _id, position, textAreaInput }) => {
        return Appointment.findByIdAndUpdate(
          _id,
          { position, textAreaInput },
          { new: true }
        );
      })
    );


    res.json(results);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error updating appointments', error });
  }
});




router.post("/cleanup-twilio", jwtCheck, async (req, res) => {
  try {
    const dryRun = req.body?.dryRun || false;


    // ✅ Obtener todos los sid de ambas colecciones
    const appointmentSids = await Appointment.distinct("sid");
    const manualContactSids = await ManualContact.distinct("sid");

    const allValidSids = new Set([...appointmentSids, ...manualContactSids]);

    // ✅ Listar conversaciones en Twilio
    const twilioConvos = await client.conversations.v1.conversations.list({ limit: 1000 });
    const deletions = [];

    for (const convo of twilioConvos) {
      if (!allValidSids.has(convo.sid)) {
        if (!dryRun) {
          await client.conversations.v1.conversations(convo.sid).remove();
        }
        deletions.push(convo.sid);
      }
    }

    res.json({
      success: true,
      dryRun,
      deletedCount: deletions.length,
      deletedSids: deletions,
    });
  } catch (err) {
    console.error("❌ Error durante la limpieza:", err);
    res.status(500).json({ error: "Error during cleanup", detail: err.message });
  }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const doc = await Appointment.findById(id)
      .populate({
        path: 'priority',
        model: 'PriorityList',
        select: 'id description notes durationHours name color org_id',
      })
      .populate({
        path: 'treatment',
        model: 'Treatment',
        select: '_id name duration icon minIcon color category active',
      })
      .populate({
        path: 'selectedDates.days.timeBlocks',
        model: 'TimeBlock',
        select: '_id org_id blockNumber label short from to',
      })
  
      .lean({ virtuals: true });

    if (!doc) return res.status(404).json({ error: 'Appointment not found' });

    res.json({ data: doc });
  } catch (err) {
    console.error('GET /appointments/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
