const express = require('express');
const router = express.Router();
const helpers = require('../helpers');
const { Appointment, Categories, PriorityList, ManualContact } = require('../models/Appointments');
//const { GoogleGenerativeAI } = require("@google/generative-ai");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { attachUserInfo, jwtCheck, checkJwt, decodeToken } = require('../middleware/auth');
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

const DOMPurify = require('isomorphic-dompurify');
const { exist } = require('joi');





//RUTAS PROTEGIDAS
router.use(jwtCheck);
router.use(attachUserInfo); // /send





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

router.get('/query/:collection', jwtCheck, async (req, res) => {
  try {
    const { collection } = req.params;
    const Model = models[collection];
    //console.log("models", models)

    if (!Model) {
      return res.status(400).json({ error: 'Invalid collection name' });
    }

    // 🔐 Obtener org_id desde token
    const { org_id } = await helpers.getTokenInfo(req.headers.authorization);

    let filters = {};
    let populate = [];
    let limit = 50;

    // Parsear query (filtros MongoDB)
    if (req.query.query) {
      filters = typeof req.query.query === 'string'
        ? JSON.parse(req.query.query)
        : req.query.query;

      if (req.query.convertObjectId === 'true') {
        filters = convertIdsInFilter(filters);
      }
    }
    console.log("Filter : ", filters)

    let projection = {};

    if (req.query.projection) {
      projection = typeof req.query.projection === 'string'
        ? JSON.parse(req.query.projection)
        : req.query.projection;
    }

    // ⬅️ Añadir org_id automáticamente
    filters.org_id = org_id;
    //console.log("filters", filters, Model);
    // Parsear populate
    if (req.query.populate) {
      populate = typeof req.query.populate === 'string'
        ? JSON.parse(req.query.populate)
        : req.query.populate;
    }

    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit);
      if (!isNaN(parsedLimit)) {
        limit = parsedLimit;
      }
    }

    // Construir y ejecutar la consulta
    let query = Model.find(filters, projection);
    if (populate && Array.isArray(populate)) {
      populate.forEach(p => {
        if (p?.path) {
          query = query.populate(p.path, p.select);
        }
      });
    }

    query = query.limit(limit);


    const result = await query.lean();
    //console.log("result", result);
    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error fetching collection:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.patch("/update-items", jwtCheck, async (req, res) => {
  const { org_id, sub } = await helpers.getTokenInfo(req.headers.authorization);

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
      data = { ...data, unknown: data.unknown?data.unknown:false };
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
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    // 🔐 Extraer org_id (y opcionalmente user_id) del token
    const { org_id, sub, org_name } = await helpers.getTokenInfo(authHeader);
    const orgName = helpers.cleanOrgName(org_name)
    if (!org_id) {
      return res.status(400).json({ error: 'org_id not found in token' });
    }

    const { modelName, data } = req.body;

    // ✅ Validaciones básicas
    if (!modelName || typeof modelName !== 'string') {
      return res.status(400).json({ error: 'modelName is required and must be a string' });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'data must be a valid object' });
    }
    let sid;
    const proxyAddress = process.env.TWILIO_FROM_MAIN
    //asociar conversación con nuevo contacto creado
    if (modelName == models.Appointment.modelName) {
      const formattedPhone = helpers.localToE164AU(data.phoneInput);
      //Buscar si es que el numero del nuevo contacto ya tiene una conversación asignada
      console.log("formattedPhone", formattedPhone)
      //const existingSid = await findConversationByPhoneSafely(formattedPhone)
      const existingSid = await findConversationByPhoneTwilioOnly(formattedPhone);
      console.log("existingSid", existingSid)
      //no->crear una nueva conversacion con atributos personalizados
      const meta = {
        phone: data.phoneInput,
        name: data.nameInput,
        patientId: data.nameInput._id,
        org_id: org_id,
      };
      sid = !existingSid
        ? await sms.createConversationAndAddParticipant(formattedPhone, proxyAddress, meta)
        //si->unirlo
        : existingSid
      // await sms.addSmsParticipantToConversation(existingSid,formattedPhone, "+61482088223")

    }




    // 🔐 Asociar org_id (y opcional user_id si lo deseas)
    const enrichedData = {
      ...data,
      org_id,
      ...(sid && { sid }), // ← esto agrega `sid` solo si existe
      ...(proxyAddress && { proxyAddress }), // agrega `proxyAddress` solo si existe
      lastMessage: new Date(),
      unknown: false, // forzamos unknown=false
      org_name: orgName,
      createdBy: sub,
      createdAt: new Date(),
    };


    // 📦 Obtener o definir el modelo dinámico (usando esquema flexible)
    const Model = models[modelName] || mongoose.model(
      modelName,
      new mongoose.Schema({}, { strict: false, collection: modelName })
    );

    // 💾 Guardar documento
    const newDoc = new Model(enrichedData);
    const savedDoc = await newDoc.save();

    return res.status(201).json({ message: 'Document created successfully', document: savedDoc });

  } catch (error) {
    console.error('[POST /add] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});




const MAX_LIMIT = 25;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function escapeRegExp(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /appointments/mentions?nameInput=<q>&limit=8
 * Devuelve: { items: Array<MentionItem> }
 * MentionItem:
 *  - id: _id de la cita
 *  - nameInput: Appointment.nameInput
 *  - type: "appointment"
 *  - subtitle: info breve (ej: lastNameInput + phone/email)
 *  - avatarUrl: (no se define en Appointment; lo dejamos undefined)
 *  - ...doc: toda la info vinculada de la cita (lean)
 * const { requireAuth } = require('../middleware/auth');
 */
const { requireAuth } = require('../middleware/auth');
router.get('/appointments/mentions', requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const { org_id } = await helpers.getTokenInfo(authHeader);
    if (!org_id) return res.status(403).json({ error: 'Unauthorized: org_id not found' });

    const raw = String(req.query.nameInput || req.query.q || '').trim();
    const limit = clamp(parseInt(req.query.limit, 10) || 8, 1, MAX_LIMIT);
    if (!raw) return res.json({ items: [] });

    // Prefijo (rápido y predecible). Si quieres contains, quita el ^.
    const regex = new RegExp('^' + escapeRegExp(raw), 'i');

    // Buscar por nameInput y, de apoyo, lastNameInput / phoneInput / emailInput
    const query = {
      org_id,
      $or: [
        { nameInput: { $regex: regex } },
        { lastNameInput: { $regex: regex } },
        { phoneInput: { $regex: regex } },
        { emailInput: { $regex: regex } },
      ],
    };

    // Ordenamos por actividad reciente si existe, luego por _id desc
    const docs = await Appointment.find(query)
      .sort({ lastMessage: -1, _id: -1 })
      .limit(limit)
      .lean();
      console.log("query", query, docs);

    const items = docs.map((doc) => {
      const subtitleParts = [];
      if (doc.lastNameInput) subtitleParts.push(doc.lastNameInput);
      if (doc.phoneInput) subtitleParts.push(doc.phoneInput);
      else if (doc.emailInput) subtitleParts.push(doc.emailInput);

      return {
        id: String(doc._id),
        nameInput: doc.nameInput || '',       // display principal
        type: 'appointment',
        avatarUrl: undefined,                  // Appointment no define avatar
        subtitle: subtitleParts.join(' · ') || undefined,
        ...doc,                                // toda la info vinculada disponible
      };
    });

    res.json({ items });
  } catch (err) {
    console.error('GET /appointments/mentions error:', err);
    res.status(500).json({ error: 'Internal server error' });
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



module.exports = router;
