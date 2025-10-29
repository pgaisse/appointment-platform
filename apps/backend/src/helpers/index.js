const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { decodeToken } = require('../middleware/auth');
const { addMinutes } = require('date-fns');

const aws = require('../helpers/aws');
const { Appointment, MessageLog, MediaFile } = require('../models/Appointments');
// Cargar los plugins
dayjs.extend(utc);
dayjs.extend(timezone);
const timeZone = 'Australia/Sydney';
const models = require("../models/Appointments");
const colorAssigned = [
  '#0078D4', '#CA5010', '#107C10', '#D13438', '#5C2D91',
  '#038387', '#986F0B', '#00B7C3', '#C239B3', '#7A7574',
  '#F1C40F', '#2ECC71', '#E74C3C', '#3498DB', '#9B59B6',
  '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#D5DBDB',
];

function getColor() {
  const index = Math.floor(Math.random() * colorAssigned.length);
  return colorAssigned[index];
}

const formatOrgName = (org_name) => {
  if (!org_name) return '';
  return org_name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

function filterAndSortByScore(data) {
  return data
    .filter(item => {
      let jsfitScores = [];
      try {
        jsfitScores = item.fitScore;
      } catch {
        return false;
      }
      return jsfitScores.some(s => s.score >= 0.85);
    })
    .sort((a, b) => (b.maxScore || 0) - (a.maxScore || 0))
    .slice(0, 3);
}

const getDurationByName = async (name, priorityList) => {
  const totalItems = priorityList.length;
  const found = priorityList.find(p => p.name === name);
  return {
    found: found ? found.durationHours : null,
    score: found ? (totalItems - found.id) / (totalItems - 1) : 0,
    color: found ? found.color : 'gray',
  };
};

function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}


dayjs.extend(utc);
dayjs.extend(timezone);

const formatSydney = (date) =>
  dayjs(date).tz("Australia/Sydney").format("YYYY-MM-DD HH:mm:ss");

const TOLERANCE_MS = 2 * 60 * 1000; // tolerancia de 2 minutos

// Une intervalos discontinuos con tolerancia
function mergeIntervals(intervals) {
  if (!intervals.length) return [];

  intervals.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const merged = [];
  let current = {
    startDate: new Date(intervals[0].startDate),
    endDate: new Date(intervals[0].endDate),
  };

  for (let i = 1; i < intervals.length; i++) {
    const interval = intervals[i];
    const start = new Date(interval.startDate);
    const end = new Date(interval.endDate);

    if (start.getTime() <= current.endDate.getTime() + TOLERANCE_MS) {
      // Se unen
      if (end > current.endDate) current.endDate = end;
    } else {
      merged.push({ ...current });
      current = { startDate: start, endDate: end };
    }
  }

  merged.push({ ...current });
  return merged;
}

// Verifica si el slot está contenido en alguno de los intervalos unidos
function slotContainedInIntervals(slotStart, slotEnd, intervals) {
  for (const interval of intervals) {
    if (slotStart >= interval.startDate && slotEnd <= interval.endDate) {
      return true;
    }
  }
  return false;
}
const FIT_TYPES = {
  CONTAINS_RANGE: "contains_range",
  WITHIN_RANGE: "within_range",
  PARTIAL_OVERLAP: "partial_overlap",
  NONE: "none"
};

const getBestPatient2 = async (params) => {


  return allPatientsWithScores;
};


const {
  isWithinInterval,
  areIntervalsOverlapping,
  eachDayOfInterval,
  format,
  differenceInMinutes,
} = require("date-fns");

async function findMatchingAppointments(startDate, endDate, authorization) {
  //console.log("🔍 Rango de búsqueda:", startDate, "->", endDate);
  startDate = new Date(startDate);
  endDate = new Date(endDate);

  const org_id = (await getTokenInfo(authorization)).org_id;
  //console.log("🏢 Org ID:", org_id);

  const appointments = await models.Appointment.find({
    org_id,
    "selectedDates.startDate": { $lte: endDate },
    $or: [
      { "selectedDates.endDate": { $gte: startDate } },
      {
        "selectedAppDates.startDate": { $lte: endDate },
        "selectedAppDates.endDate": { $gte: startDate },
      },
    ],
  })
    .populate("priority")
    .populate("selectedDates.days.timeBlocks");

  //console.log(`📋 Total appointments encontrados: ${appointments.length}`);

  const bestMatchesPerAppointment = new Map();

  for (const appt of appointments) {
    const apptId = appt._id.toString();
    const apptRange = {
      start: appt.selectedDates?.startDate || appt.selectedAppDates?.[0]?.startDate,
      end: appt.selectedDates?.endDate || appt.selectedAppDates?.[0]?.endDate,
    };

    if (!apptRange.start || !apptRange.end) continue;
    if (!areIntervalsOverlapping(apptRange, { start: startDate, end: endDate })) continue;

    const overlapStart = new Date(Math.max(apptRange.start.getTime(), startDate.getTime()));
    const overlapEnd = new Date(Math.min(apptRange.end.getTime(), endDate.getTime()));

    const availableDays = appt.selectedDates?.days || [];
    const daysToCheck = eachDayOfInterval({ start: overlapStart, end: overlapEnd });

    const durationMs = (appt.priority?.durationHours || 1) * 60 * 60 * 1000;
    let bestMatch = null;

    for (const day of daysToCheck) {
      const weekday = format(day, "EEEE");
      const matchedDay = availableDays.find((d) => d.weekDay === weekday);
      if (!matchedDay) continue;

      for (const block of matchedDay.timeBlocks) {
        const [fromHour, fromMin] = block.from.split(":").map(Number);
        const [toHour, toMin] = block.to.split(":").map(Number);

        const fromTime = new Date(day);
        fromTime.setHours(fromHour, fromMin, 0);

        const toTime = new Date(day);
        toTime.setHours(toHour, toMin, 0);

        const blockDuration = toTime - fromTime;

        if (blockDuration >= durationMs) {
          const matchedInterval = {
            startDate: fromTime,
            endDate: new Date(fromTime.getTime() + durationMs),
          };

          const fitScore = differenceInMinutes(fromTime, startDate); // menor = mejor

          if (!bestMatch || fitScore < bestMatch.fitScore) {
            bestMatch = {
              appointment: appt,
              matchedInterval,
              fitScore,
            };
          }
        }
      }
    }

    if (bestMatch) {
      bestMatchesPerAppointment.set(apptId, bestMatch);
    }
  }

  // Agrupar por prioridad
  const grouped = new Map(); // Map<priorityId, AppointmentGroup>

  for (const { appointment, matchedInterval, fitScore } of bestMatchesPerAppointment.values()) {
    const priorityId = appointment.priority.id.toString();

    if (!grouped.has(priorityId)) {
      grouped.set(priorityId, {
        dateRange: { startDate, endDate },
        priority: appointment.priority,
        appointments: [],
      });
    }

    grouped.get(priorityId).appointments.push({
      ...appointment.toObject(),
      fitScore,
      matchedInterval,
    });
  }

  const result = [];

  for (const group of grouped.values()) {
    // ✅ Ordenar por fitScore y limitar a 5
    group.appointments.sort((a, b) => a.fitScore - b.fitScore);
    group.appointments = group.appointments.slice(0, 5);
    result.push(group);
  }

  // Log final
  /*for (const group of result) {
    console.log(`🟡 Prioridad ${group.priority.name} → ${group.appointments.length} pacientes sugeridos`);
    group.appointments.forEach((a, i) => {
      console.log(
        `   ${i + 1}. ${a.nameInput} (${a.fitScore} minutos desde inicio), ${a.matchedInterval.startDate.toISOString()}`
      );
    });
  }*/

  return result;
}



const getTokenInfo = async (token) => {
  const dec = decodeToken(token);

  return {
    token,
    org_id: dec.org_id,
    user_id: dec.id,
    org_name: dec["https://iconicsmile.com/org_name"], // ✅ aquí accedes correctamente
    azp: dec.azp,
    sub: dec.sub,
  };
};

const jwt = require("jsonwebtoken");

async function getTokenInfo2(authHeader) {
  const token = authHeader.replace("Bearer ", "");
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded) throw new Error("Invalid token");

  // Aquí puedes ver todo el payload
  console.log("decoded payload:", decoded.payload);

  return {
    org_id: decoded.payload.org_id,
    account_sid: decoded.payload.account_sid,
    sub: decoded.payload.sub
  };
}



function capitalizeWords(text) {
  if (!text) return text;
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function cleanOrgName(input) {
  if (!input) return '';
  return input
    .replace(/[-_]/g, ' ')              // reemplaza guiones bajos o medios por espacios
    .replace(/\s+/g, ' ')               // elimina espacios duplicados
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // capitaliza cada palabra
}

const getDateRange = () => {
  const today = new Date();

  // Obtener el día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)
  const dayOfWeek = today.getDay();

  // Calcular el lunes de la semana actual (restar días si no es lunes)
  const start = new Date(today);
  const diffToMonday = (dayOfWeek + 6) % 7; // convierte domingo (0) en 6, lunes (1) en 0, etc.
  start.setDate(today.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0); // inicio del día

  // Extender a 60 días (aproximadamente 2 meses) para cubrir "this month" y rangos custom
  const end = new Date(start);
  end.setDate(start.getDate() + 60); // 60 días en lugar de 13
  end.setHours(23, 59, 59, 999); // fin del día
  return { start, end }
};
function localToE164AU(localNumber) {
  if (typeof localNumber !== 'string') {
    throw new Error('El número debe ser un string');
  }

  // Elimina espacios, guiones y paréntesis
  const cleaned = localNumber.replace(/[\s\-()]/g, '');

  // Valida: debe empezar con 0 y tener 10 dígitos en total
  if (!/^0\d{9}$/.test(cleaned)) {
    throw new Error(`Número australiano inválido: ${localNumber}`);
  }

  // Reemplaza el 0 inicial por +61
  return '+61' + cleaned.slice(1);
}
function buildObjectWithNullDefaults(schemaPaths, inputData) {
  const output = {};

  for (const key in schemaPaths) {
    if (key === '__v' || key === '_id') continue;
    output[key] = null;
  }

  for (const key in inputData) {
    if (key in output) {
      const value = inputData[key];
      const schemaField = schemaPaths[key];

      // Si el campo es ObjectId y el valor es string vacío → ignorar
      if (schemaField && schemaField.instance === 'ObjectID' && value === '') continue;

      output[key] = value;
    }
  }

  return output;
}
// Limpieza automática: si algún campo tiene "", y su tipo esperado es ObjectId, eliminarlo
function buildObjectWithCleanedValues(schemaPaths, inputData) {
  const output = {};

  for (const key in schemaPaths) {
    if (key === '__v' || key === '_id') continue;

    const schemaField = schemaPaths[key];
    const value = inputData[key];

    if (value === '' && schemaField?.instance === 'ObjectID') {
      output[key] = null; // evita el cast error
    } else if (value !== undefined) {
      output[key] = value;
    } else {
      output[key] = null;
    }
  }

  return output;
}
const twilio = require('twilio');
// utils/normalizeTwilio.js

function normalizeMessage(input = {}) {
  const {
    // ConversationSid <- conversation_sid | conversationSid | CONVERSATION_SID | sid | SID
    ConversationSid: ConversationSid =
    input.conversation_sid ?? input.conversationSid ?? input.CONVERSATION_SID ?? input.sid ?? input.SID ?? '',

    // Media <- media | MEDIA
    Media: Media = input.media ?? input.MEDIA ?? input.Media ?? [],

    // Body <- body | BODY
    Body: Body = input.body ?? input.BODY ?? input.Body ?? '',

    // ChatServiceSid <- chat_service_sid | chatServiceSid | CHAT_SERVICE_SID
    ChatServiceSid: ChatServiceSid =
    input.chat_service_sid ?? input.chatServiceSid ?? input.CHAT_SERVICE_SID ?? input.Chat_Service_Sid ?? '',

    // AccountSid <- account_sid | accountSid | ACCOUNT_SID
    AccountSid: AccountSid =
    input.account_sid ?? input.accountSid ?? input.ACCOUNT_SID ?? input.Account_Sid ?? '',

    // Source <- source | SOURCE
    Source: Source = input.source ?? input.SOURCE ?? input.Source ?? '',

    // RetryCount <- retry_count | retryCount | RETRY_COUNT
    RetryCount: RetryCount =
    input.retry_count ?? input.retryCount ?? input.RETRY_COUNT ?? 0,

    // Author <- author | AUTHOR
    Author: Author = input.author ?? input.AUTHOR ?? input.Author ?? '',

    // MessageSid <- message_sid | messageSid | MESSAGE_SID
    MessageSid: MessageSid =
    input.message_sid ?? input.messageSid ?? input.MESSAGE_SID ?? input.Message_Sid ?? '',

    // DateCreated <- date_created | dateCreated | DATE_CREATED
    DateCreated: DateCreated =
    input.date_created ?? input.dateCreated ?? input.DATE_CREATED ?? input.Date_Created ?? new Date(),
  } = input;

  // (opcional) blindaje: fuerza Media a []
  const SafeMedia = Array.isArray(Media) ? Media : [];

  return {
    ConversationSid,
    Media: SafeMedia,
    Body,
    ChatServiceSid,
    AccountSid,
    Source,
    RetryCount,
    Author,
    MessageSid,
    DateCreated,
  };
}



const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function loadImage(input, org_id) {
  normalizedInput = normalizeMessage(input.body)
  const {
    Media = [],
    Body = '',
    Author = '',
    DateCreated,
    MessageSid,
    ConversationSid,
  } = normalizedInput;

  console.log("prueba par ver que recibe", ConversationSid, Media, Body, Author, MessageSid, DateCreated);
  // console.log('NormalizedInput', normalizedInput);

  if (!ConversationSid) throw new Error('ConversationSid es requerido');

  // 2) Obtener serviceSid (IS...) de la conversación (evita mismatches)
  const conv = await client.conversations.v1.conversations(ConversationSid).fetch();
  console.log("Conversation fetched:", conv);
  const serviceSid = conv.serviceSid || conv.chatServiceSid;
  if (!serviceSid) throw new Error(`No se encontró serviceSid para ${ConversationSid}`);

  const uploaded = [];

  // 3) Si hay media, descargar desde MCS y subir a tu storage
  for (const m of Media) {
    if (!m?.Sid) continue;

    const contentUrl = `https://mcs.${MCS_REGION}.twilio.com/v1/Services/${serviceSid}/Media/${m.Sid}/Content`;

    // Descarga binaria del contenido
    const resp = await axios.get(contentUrl, {
      responseType: 'arraybuffer',
      auth: { username: ACCOUNT_SID, password: AUTH_TOKEN },
      maxRedirects: 5,
    });
    const buffer = Buffer.from(resp.data);

    // Sube a tu storage (S3) y persiste en Mongo
    const key = await aws.uploadFileFromBuffer(buffer, org_id, {
      folderName: 'chat-media',
      contentType: m.ContentType || 'application/octet-stream',
      originalName: m.Filename || `${m.Sid}`,
      fieldName: 'twilio',
    });

    let signedUrl = null;
    try { signedUrl = await aws.getSignedUrl(key); } catch { }

    const filename = signedUrl || key;
    console.log("nueva URL firmada:", signedUrl);
    // Upsert para evitar duplicados por reintentos
    const doc = await MediaFile.findOneAndUpdate(
      { sid: m.Sid, org_id },
      {
        $set: {
          category: m.Category || 'media',
          filename,
          size: m.Size || buffer.length,
          content_type: m.ContentType || 'application/octet-stream',
        },
      },
      { upsert: true, new: true }
    );

    uploaded.push({
      sid: m.Sid,
      key,
      filename: doc.filename,
      content_type: doc.content_type,
      size: doc.size,
    });
  }

  // 4) (Opcional) Log de mensaje de texto si no hay media
  if (!Media.length && Body) {
    try {
      await MessageLog.create({
        org_id,
        conversation_sid: ConversationSid,
        message_sid: MessageSid,
        author: Author,
        body: Body,
        date_created: DateCreated ? new Date(DateCreated) : new Date(),
      });
    } catch (e) {
      console.warn('No se pudo guardar MessageLog:', e.message);
    }
  }

  return {
    success: true,
    conversationSid: ConversationSid,
    uploaded, // array de archivos guardados (vacío si fue solo texto)
    body: Body,
    author: Author,
    messageSid: MessageSid,
  };
}


const refreshSocketObject = async (appointment, req) => {
  if (!req?.io) {
    throw new Error("Io is not available");
  }
  console.log("req.body", req.body);
  let {
    Media = [],
    Body = '',
    Author = '',
    DateCreated,
    MessageSid,
  } = req.body || {};
  console.log("Entró a refreshSocketObject", { Media, Body, Author, DateCreated, MessageSid });
  // Normalizar Media: si viene como string JSON, parsearlo
  if (typeof Media === 'string') {
    try {
      Media = JSON.parse(Media);
    } catch (e) {
      console.error("❌ Error al parsear Media JSON:", e);
      Media = [];
    }
  }

  // Si no es array, forzamos array vacío
  if (!Array.isArray(Media)) {
    Media = [];
  }
  const orgRoom = (appointment.org_id || '').toLowerCase().trim();
  if (!orgRoom) {
    throw new Error("org_id inválido en appointment");
  }

  // Sube/recupera medias si hay; si no, obtenemos []
  let uploadedMediaFiles = [];

  try {
    uploadedMediaFiles = Array.isArray(Media) && Media.length > 0
      ? (console.log("entrando a loadimage"), await loadImage(req, orgRoom)) // ← ya evita duplicados y guarda en DB
      : []
  } catch (e) {
    console.error("⚠️ Error en loadImage:", e?.message);
    uploadedMediaFiles = [];
  }

  console.log("Media subidas:", uploadedMediaFiles);
  // Construye SIEMPRE un único chatmessage, con o sin media
  const chatmessage = [{
    sid: appointment.sid,                         // SID de la conversación del appointment
    nextToken: '',
    name: `${appointment.nameInput || ''} ${appointment.lastNameInput ?? ''}`.trim(),
    phone: appointment.phoneInput,
    author: (Author || '').toLowerCase().replace(/\s+/g, '_'),
    body: Body || '',
    avatar: undefined,
    dateCreated: DateCreated ? new Date(DateCreated) : new Date(),
    appId: appointment._id,
    messageSid: MessageSid,
    media: uploadedMediaFiles || [],                    // [] si no hay media
  }];

  // Payload que espera tu frontend
  const data = {
    name: `${appointment.nameInput || ''} ${appointment.lastNameInput ?? ''}`.trim(),
    lastmessage: appointment.lastMessage,
    chatmessage,       // en un array, un solo mensaje
    appId: appointment._id,
  };

  // Emitir al room de la org
  req.io.to(orgRoom).emit('smsReceived', [data]);
  console.log("📡 Emitido por socket correctamente", JSON.stringify(data, null, 2));
};

const DOMPurify = require("isomorphic-dompurify");

function sanitizeInput(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],        // no permitir etiquetas HTML
    ALLOWED_ATTR: []         // no permitir atributos HTML
  });
}
module.exports = {
  getTokenInfo2,
  sanitizeInput,
  loadImage,
  refreshSocketObject,
  buildObjectWithCleanedValues,
  buildObjectWithNullDefaults,
  localToE164AU,
  formatOrgName,
  cleanOrgName,
  getColor,
  getTokenInfo,
  capitalizeWords,
  getBestPatient2,
  getDateRange,
  findMatchingAppointments
};
