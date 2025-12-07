// src/models/Appointments.js
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ContactStatus, MsgType } = require('../constants');

// ⬇️ Sub-schema simple (sin validadores de base de datos)
const RepresentativeSchema = require('../schemas/representative');

// Util para normalizar teléfonos AU a E.164
function toE164AU(input) {
  const raw = String(input || '').replace(/[^\d+0-9]/g, '');

  if (/^\+61\d{9}$/.test(raw)) return raw;           // +61XXXXXXXXX
  if (/^61\d{9}$/.test(raw)) return `+${raw}`;       // 61XXXXXXXXX -> +61XXXXXXXXX
  if (/^0\d{9}$/.test(raw)) return `+61${raw.slice(1)}`; // 0XXXXXXXXX -> +61XXXXXXXXX

  throw new Error(`Número AU inválido: ${input}`);
}

/* ======================= Schemas auxiliares ======================= */

// Priority
const PrioritySchema = new Schema({
  org_id: { type: String, required: true },
  id: { type: Number, required: true },
  description: { type: String, required: true },
  notes: { type: String, default: '' },
  durationHours: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
}, { collection: 'PriorityList' });

PrioritySchema.index({ org_id: 1, name: 1 }, { unique: true });
PrioritySchema.index({ org_id: 1, id: 1 }, { unique: true });

// Fechas propuestas / confirmaciones para citas
const ConfirmationSchema = new Schema({
  decision: {
    type: String,
    enum: ['confirmed', 'declined', 'reschedule', 'unknown'],
    default: 'unknown',
  },
  decidedAt: { type: Date },
  byMessageSid: { type: String },
  lateResponse: { type: Boolean, default: false },
  // Timestamps y trazabilidad de la solicitud
  sentAt: { type: Date },           // hora exacta de envío de la notificación
  askMessageSid: { type: String },  // SID del mensaje de “ask”
  deliveredAt: { type: Date },      // opcional: cuando Twilio reporta delivered
}, { _id: false });

const ReminderSchema = new Schema({
  msg: { type: String, default: '' },
  tz: { type: String, default: 'Australia/Sydney' },
  whenISO: { type: String, default: '' }, // local ISO string
  scheduled: { type: Boolean, default: false },
  scheduledSid: { type: String, default: null },
  runAtLocal: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // usuario que definió el recordatorio
  createdAt: { type: Date }, // fecha de creación del recordatorio
}, { _id: false });

const SelectedAppDateSchema = new Schema({
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NoContacted },
  rescheduleRequested: { type: Boolean, default: false },
  
  // ⬇️ NUEVO: Cada slot tiene su propio treatment, priority, providers, duration y position
  treatment: { type: Schema.Types.ObjectId, ref: 'Treatment', default: null },
  priority: { type: Schema.Types.ObjectId, ref: 'PriorityList', default: null },
  providers: [{ type: Schema.Types.ObjectId, ref: 'Provider', default: [] }],
  duration: { type: Number, default: 60 }, // duración en minutos
  position: { type: Number, default: 0 }, // posición dentro de la columna de prioridad
  providerNotes: { type: String, default: '' },
  needsScheduling: { type: Boolean, default: true }, // indica si el slot necesita que se le asigne una fecha
  
  // Sentinel para conservar la ventana ORIGINAL sobre la cual se generó la propuesta
  origin: {
    startDate: { type: Date }, // copia inmutable de startDate previo a la primera propuesta
    endDate: { type: Date },   // copia inmutable de endDate previo a la primera propuesta
    capturedAt: { type: Date }, // cuándo se tomó el snapshot
  },
  // Historial mínimo de cambios de start/end (solo últimos valores previos) para auditoría ligera
  history: [
    {
      startDate: { type: Date },
      endDate: { type: Date },
      changedAt: { type: Date },
      reason: { type: String },
    }
  ],
  proposed: {
    startDate: { type: Date },
    endDate: { type: Date },
    proposedBy: { type: String, enum: ['clinic', 'patient', 'system'], default: 'clinic' },
    reason: { type: String },
    createdAt: { type: Date },
  },
  confirmation: ConfirmationSchema,
  reminder: { type: ReminderSchema, default: {} },
}, { _id: true, timestamps: true });

// Validación: Si hay fecha, ambas deben estar presentes
SelectedAppDateSchema.pre('validate', function(next) {
  const hasStart = this.startDate != null;
  const hasEnd = this.endDate != null;
  
  // Si una tiene fecha, ambas deben tenerla
  if (hasStart !== hasEnd) {
    return next(new Error('Both startDate and endDate must be set together'));
  }
  
  // Si ambas tienen fecha, marcar como programado
  if (hasStart && hasEnd) {
    this.needsScheduling = false;
  } else {
    this.needsScheduling = true;
  }
  
  next();
});

/* ======================= Appointment (principal) ======================= */

const AppointmentsSchema = new Schema({
  // Subdocumento: representante
  representative: { type: RepresentativeSchema, default: {} },

  // Requerido según tu lógica (asegúrate de setearlo en el endpoint)
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  proxyAddress: String,
  contactPreference: { type: String, enum: ['call', 'sms'], trim: true },
  unknown: Boolean,

  sid: String,
  lastMessage: Date,
  lastMessageInteraction: { type: String, default: '' },

  // Entrada original
  nameInput: String,
  
  lastNameInput: String,
  emailInput: String,
  // Nota: no usar default '' para permitir documentos sin el campo cuando es dependiente
  phoneInput: { type: String, index: true }, 

  // Normalizados para unicidad
  phoneE164: { type: String, default: '', index: true },
  emailLower: { type: String, default: '', index: true },

  textAreaInput: String,

  // ⬇️ DEPRECATED: treatment, priority y providers movidos a selectedAppDates (cada slot tiene los suyos)
  // Mantener por compatibilidad temporal durante migración
  treatment: { type: Schema.Types.ObjectId, ref: 'Treatment', default: null },
  priority: { type: Schema.Types.ObjectId, ref: 'PriorityList', default: null },
  providers: [{ type: Schema.Types.ObjectId, ref: 'Provider', default: [] }],
  
  note: String,
  color: String,

  user_id: String,
  org_id: { type: String, index: true },
  org_name: String,

  position: Number,
  contactMessages: [{ type: Schema.Types.ObjectId, ref: 'MessageLog' }],
  reschedule: { type: Boolean, default: false },

  selectedDates: {
    startDate: Date,
    endDate: Date,
    days: [{
      weekDay: String,
      timeBlocks: [{ type: Schema.Types.ObjectId, ref: 'TimeBlock' }],
    }],
  },

  selectedAppDates: { type: [SelectedAppDateSchema], default: [] },

  // DEPRECATED: Per-slot provider assignments (now handled by selectedAppDates.providers)
  providerNotes: { type: String, default: '' },
  isProviderLocked: { type: Boolean, default: false },
  location: { type: Schema.Types.ObjectId, ref: 'Location', default: null },
  chair: { type: Schema.Types.ObjectId, ref: 'Chair', default: null },
}, { timestamps: true });

// ──────────────── Migration Helpers ────────────────
// 📝 IMPORTANTE: Los campos treatment, priority, providers están DEPRECATED en el root.
// Ahora cada slot en selectedAppDates tiene sus propios treatment/priority/providers/duration.

/**
 * Virtual: Devuelve el treatment del primer slot si existe, sino el del root (deprecated)
 * Útil para compatibilidad durante la migración
 */
AppointmentsSchema.virtual('effectiveTreatment').get(function() {
  return this.selectedAppDates?.[0]?.treatment || this.treatment;
});

/**
 * Virtual: Devuelve el priority del primer slot si existe, sino el del root (deprecated)
 */
AppointmentsSchema.virtual('effectivePriority').get(function() {
  return this.selectedAppDates?.[0]?.priority || this.priority;
});

/**
 * Virtual: Devuelve los providers del primer slot si existen, sino los del root (deprecated)
 */
AppointmentsSchema.virtual('effectiveProviders').get(function() {
  const slotProviders = this.selectedAppDates?.[0]?.providers;
  return (slotProviders && slotProviders.length > 0) ? slotProviders : this.providers;
});

/**
 * Método de instancia: Migra treatment/priority/providers del root al PRIMER slot únicamente.
 * Útil para actualizar appointments existentes del formato legacy.
 */
AppointmentsSchema.methods.migrateToSlotFields = function() {
  if (!this.selectedAppDates || this.selectedAppDates.length === 0) {
    return false;
  }

  let modified = false;
  const rootTreatment = this.treatment;
  const rootPriority = this.priority;
  const rootProviders = this.providers || [];

  // ⚠️ SOLO migrar al PRIMER slot
  const firstSlot = this.selectedAppDates[0];
  
  if (!firstSlot.treatment && rootTreatment) {
    firstSlot.treatment = rootTreatment;
    modified = true;
  }
  if (!firstSlot.priority && rootPriority) {
    firstSlot.priority = rootPriority;
    modified = true;
  }
  if ((!firstSlot.providers || firstSlot.providers.length === 0) && rootProviders.length > 0) {
    firstSlot.providers = [...rootProviders];
    modified = true;
  }
  if (!firstSlot.duration) {
    // Intentar obtener duration del treatment si está poblado
    const treatmentDuration = typeof rootTreatment === 'object' && rootTreatment?.duration
      ? rootTreatment.duration
      : 60;
    firstSlot.duration = treatmentDuration;
    modified = true;
  }

  return modified;
};

/**
 * Método estático: Migra todos los appointments de una organización
 * del formato antiguo (campos en root) al nuevo (campos en slots)
 */
AppointmentsSchema.statics.migrateBulkToSlotFields = async function(org_id, dryRun = true) {
  const appointments = await this.find({
    org_id,
    selectedAppDates: { $exists: true, $ne: [] }
  });

  const results = {
    total: appointments.length,
    modified: 0,
    errors: [],
    dryRun
  };

  for (const appt of appointments) {
    try {
      const wasModified = appt.migrateToSlotFields();
      if (wasModified) {
        results.modified++;
        if (!dryRun) {
          await appt.save();
        }
      }
    } catch (err) {
      results.errors.push({
        appointmentId: appt._id,
        error: err.message
      });
    }
  }

  return results;
};

/* ---------- Virtual: provider assignments via AppointmentProvider collection ---------- */
AppointmentsSchema.virtual('providersAssignments', {
  ref: 'AppointmentProvider',
  localField: '_id',
  foreignField: 'appointment'
});

/* ---------- Virtual: dependents (representante con múltiples niños) ---------- */
AppointmentsSchema.virtual('dependents', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'representative.appointment',
  justOne: false,
});

/* ---------- Índice para consultas por representante ---------- */
AppointmentsSchema.index({ org_id: 1, 'representative.appointment': 1 });

/* ---------- Validator en el padre (existencia, mismo org, sin ciclos) ---------- */
// --- Validator: mismo org, no self, sin ciclos (robusto en subdocs) ---
AppointmentsSchema.path('representative.appointment').validate({
  validator: async function (repId) {
    if (!repId) return true;

    // En validadores de subdocumentos, "this" es el subdoc.
    // Subimos al documento raíz si es posible:
    const rootDoc = typeof this.ownerDocument === 'function' ? this.ownerDocument() : this;

    // Si es el mismo registro -> inválido
    if (rootDoc && rootDoc._id && rootDoc._id.equals(repId)) return false;

    // Obtén el Model de forma segura:
    // - En un documento real: rootDoc.constructor es el Model
    // - Fallback por si acaso: mongoose.models.Appointment (ya compilado a estas alturas)
    const AppointmentModel =
      (rootDoc && rootDoc.constructor && rootDoc.constructor.modelName === 'Appointment' && rootDoc.constructor) ||
      require('mongoose').models.Appointment;

    if (!AppointmentModel) return false; // ultra defensivo

    // Debe existir y pertenecer al mismo org
    const rep = await AppointmentModel.findById(repId)
      .select('org_id representative')
      .lean();

    if (!rep) return false;
    if (String(rep.org_id || '') !== String(rootDoc?.org_id || '')) return false;

    // Evitar ciclos A->B->A...
    const seen = new Set();
    if (rootDoc && rootDoc._id) seen.add(String(rootDoc._id));

    let current = rep;
    let hops = 0;

    while (current?.representative?.appointment) {
      const nextId = String(current.representative.appointment);
      if (seen.has(nextId)) return false;
      seen.add(nextId);
      if (++hops > 8) return false; // límite defensivo

      current = await AppointmentModel
        .findById(nextId)
        .select('representative')
        .lean();
    }
    return true;
  },
  message: 'Vinculación de representante inválida (mismo registro, distinto org o ciclo).',
});


/* ---------- Normalización previa a validar ---------- */
AppointmentsSchema.pre('validate', function (next) {
  const raw = (this.phoneInput || '').trim();
  try {
    this.phoneE164 = raw ? toE164AU(raw) : '';
  } catch {
    this.phoneE164 = ''; // vacío → lo ignora el índice parcial
  }

  this.emailLower =
    typeof this.emailInput === 'string' ? this.emailInput.trim().toLowerCase() : '';

  if (!Array.isArray(this.providers)) this.providers = [];
  if (this.provider && !this.providers.length) this.providers = [this.provider];

  // DEPRECATED: providersAssignments normalization (now handled by AppointmentProvider collection)
  // Legacy code commented out - providers array will be auto-populated from AppointmentProvider refs

  next();
});

// DEPRECATED: Sync providers hooks (now handled by AppointmentProvider collection)
// Legacy hooks commented out - providers will be managed through AppointmentProvider collection

/* ---------- Helpers para ruteo de comunicación ---------- */
AppointmentsSchema.methods.getEffectiveContact = async function () {
  // Si este paciente tiene datos directos, se usan
  if (this.phoneE164 || this.emailLower || this.sid) {
    return {
      appointmentId: this._id,
      phoneE164: this.phoneE164 || '',
      emailLower: this.emailLower || '',
      conversationSid: this.sid || null,
      proxyAddress: this.proxyAddress || null,
    };
  }
  // Si es niño/dependiente, se usan los del representante
  if (this.representative && this.representative.appointment) {
    const rep = await this.model('Appointment')
      .findById(this.representative.appointment)
      .select('phoneE164 emailLower sid proxyAddress nameInput lastNameInput')
      .lean();

    return {
      appointmentId: this.representative.appointment,
      phoneE164: rep?.phoneE164 || '',
      emailLower: rep?.emailLower || '',
      conversationSid: rep?.sid || null,
      proxyAddress: rep?.proxyAddress || null,
      representativeName: rep ? `${rep.nameInput || ''} ${rep.lastNameInput || ''}`.trim() : '',
    };
  }
  // Sin datos en ninguno
  return { appointmentId: this._id, phoneE164: '', emailLower: '', conversationSid: null, proxyAddress: null };
};

AppointmentsSchema.methods.getConversationOwner = async function () {
  if (this.sid) return { ownerAppointmentId: this._id, conversationSid: this.sid };
  if (this.representative?.appointment) {
    const rep = await this.model('Appointment')
      .findById(this.representative.appointment)
      .select('sid')
      .lean();

    return { ownerAppointmentId: this.representative.appointment, conversationSid: rep?.sid || null };
  }
  return { ownerAppointmentId: this._id, conversationSid: null };
};

/* ---------- Protección al eliminar un representante con dependientes ---------- */
AppointmentsSchema.pre('findOneAndDelete', async function (next) {
  const doc = await this.model.findOne(this.getQuery()).select('_id org_id').lean();
  if (!doc) return next();

  const dependents = await this.model.countDocuments({
    org_id: doc.org_id,
    'representative.appointment': doc._id,
  });

  if (dependents > 0) {
    const err = new Error('No se puede eliminar: este appointment es representante de dependientes. Reasigna o desvincula primero.');
    err.name = 'DependentConstraintError';
    return next(err);
  }
  next();
});

/* ---------- Índices únicos y de consulta ---------- */
AppointmentsSchema.index(
  { org_id: 1, phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: 'string', $ne: '' } } },
);

AppointmentsSchema.index(
  { org_id: 1, emailLower: 1 },
  {
    unique: true,
    partialFilterExpression: { emailLower: { $type: 'string', $ne: '' } },
    collation: { locale: 'en', strength: 2 },
  },
);

AppointmentsSchema.index(
  { org_id: 1, sid: 1 },
  { unique: true, partialFilterExpression: { sid: { $type: 'string', $ne: '' } } },
);

AppointmentsSchema.index({
  providers: 1,
  'selectedDates.startDate': 1,
  'selectedDates.endDate': 1,
  phoneInput: 1,
});

/* ======================= Otros Schemas de tu archivo ======================= */

// Contact Appointment
const ContactSchema = new Schema({
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  // Subdocument id de Appointment.selectedAppDates (para enlazar el intento con una ventana concreta)
  selectedAppDate: { type: Schema.Types.ObjectId, default: null },
  // Fechas propuestas (persistidas en el log para no perderlas si el slot cambia)
  proposedStartDate: { type: Date, default: null },
  proposedEndDate: { type: Date, default: null },
  org_id: String,
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NotStarted },
  startDate: { type: Date },
  endDate: { type: Date },
  context: String,
  cSid: String,
  pSid: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  // Campos para diferenciar “contacted” vs “responded”
  sentAt: { type: Date },                 // hora exacta en que se envió el intento
  deliveredAt: { type: Date },            // opcional
  respondedAt: { type: Date },            // hora exacta de la respuesta
  askMessageSid: { type: String },        // correlación con el mensaje outbound
  responseMessageSid: { type: String },   // correlación con el mensaje inbound
}, { timestamps: true });

// Índice compuesto útil para ubicar intentos por appointment + subdocumento de fecha concreta
ContactSchema.index({ appointment: 1, selectedAppDate: 1 });

// Auto-asociar selectedAppDate priorizando askMessageSid y luego coincidencia por fechas (top-level o proposed)
ContactSchema.pre('save', async function (next) {
  try {
    const contact = this; // documento ContactAppointment
    if (!contact.appointment) return next();
    // Si ya está seteado, no forzamos re-asignación (evita sobreescribir manual)
    if (contact.selectedAppDate) {
      // Completar proposedStart/End si faltan y el slot tiene proposed
      try {
        const AppointmentModel = contact.model('Appointment');
        const apptLite = await AppointmentModel.findById(contact.appointment).select('selectedAppDates').lean();
        const slotLite = apptLite?.selectedAppDates?.find((sd) => String(sd._id) === String(contact.selectedAppDate));
        if (slotLite) {
          if (!contact.proposedStartDate && slotLite.proposed?.startDate) contact.proposedStartDate = slotLite.proposed.startDate;
          if (!contact.proposedEndDate && slotLite.proposed?.endDate) contact.proposedEndDate = slotLite.proposed.endDate;
        }
      } catch {}
      return next();
    }

    const AppointmentModel = contact.model('Appointment');
    const appt = await AppointmentModel
      .findById(contact.appointment)
      .select('selectedAppDates')
      .lean();

    if (!appt || !Array.isArray(appt.selectedAppDates) || appt.selectedAppDates.length === 0) return next();

    let matched = null;

    // 1) askMessageSid → slot.confirmation.askMessageSid
    if (contact.askMessageSid) {
      matched = appt.selectedAppDates.find((sd) => String(sd?.confirmation?.askMessageSid || '') === String(contact.askMessageSid)) || null;
    }

    // 2) Coincidencia por fechas (si tenemos start/end en el log)
    const hasDates = contact.startDate instanceof Date && contact.endDate instanceof Date;
    if (!matched && hasDates) {
      const sTs = contact.startDate.getTime();
      const eTs = contact.endDate.getTime();
      if (!Number.isNaN(sTs) && !Number.isNaN(eTs)) {
        // a) top-level start/end
        matched = appt.selectedAppDates.find((sd) => {
          const sdS = sd?.startDate ? new Date(sd.startDate).getTime() : NaN;
          const sdE = sd?.endDate ? new Date(sd.endDate).getTime() : NaN;
          return sdS === sTs && sdE === eTs;
        }) || null;
        // b) proposed start/end
        if (!matched) {
          matched = appt.selectedAppDates.find((sd) => {
            const ps = sd?.proposed?.startDate ? new Date(sd.proposed.startDate).getTime() : NaN;
            const pe = sd?.proposed?.endDate ? new Date(sd.proposed.endDate).getTime() : NaN;
            return ps === sTs && pe === eTs;
          }) || null;
        }
      }
    }

    // 3) Si aún no hay match pero hay sólo un slot → asumir ese (caso trivial)
    if (!matched && appt.selectedAppDates.length === 1) {
      matched = appt.selectedAppDates[0];
    }

    if (matched && matched._id) {
      contact.selectedAppDate = matched._id;
      // Completar proposedStart/End si no vienen seteados
      if (!contact.proposedStartDate && matched.proposed?.startDate) contact.proposedStartDate = matched.proposed.startDate;
      if (!contact.proposedEndDate && matched.proposed?.endDate) contact.proposedEndDate = matched.proposed.endDate;
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

// Categories
const CategoriesSchema = new Schema({
  name: String,
  description: String,
  notes: String,
  durationHours: Number,
  color: String,
  id: Number,
  user_id: String,
  org_id: String,
}, { timestamps: true });

// Media File
const MediaFileSchema = new Schema({
  category: { type: String, required: true, enum: ['media', 'audio', 'video', 'document'], trim: true },
  filename: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  content_type: { type: String, required: true, trim: true },
  sid: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

// Manual Contact
const ManualContactSchema = new Schema({
  nameInput: { type: String, required: true, trim: true, maxlength: 100 },
  lastNameInput: { type: String, required: true, trim: true, maxlength: 100 },
  phoneInput: { type: String, required: true },
  user_id: { type: String },
  org_id: { type: String },
  org_name: { type: String },
  sid: { type: String },
  lastMessage: Date,
  createdBy: { type: String },
}, { timestamps: true });

// Messages
const MessageSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  conversationId: { type: String, required: true, index: true },
  index: { type: Number, index: true, set: v => (typeof v === 'string' ? parseInt(v, 10) : v) },
  sid: { type: String, required: true, index: true },
  userId: { type: String },
  author: { type: String, required: true }, // "patient" | "clinic"
  proxyAddress: { type: String },
  type: { type: String, enum: Object.values(MsgType), default: MsgType.Message },
  body: { type: String },
  media: [{ url: { type: String, required: true }, type: { type: String }, size: { type: Number } }],
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  resolvedBySid: { type: String, index: true },
  respondsTo: { type: String, index: true },
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, index: 1 }, { unique: true });
MessageSchema.index({ sid: 1 }, { unique: true });
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// Treatment
const TreatmentSchema = new Schema({
  org_id: String,
  name: { type: String, required: true },
  duration: { type: Number, required: true },
  defaultDuration: { type: Number, default: null },
  icon: { type: String, required: true },
  minIcon: { type: String, required: true },
  color: { type: String, required: true },
  category: { type: String, default: 'General' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

TreatmentSchema.index({ org_id: 1, name: 1 }, { unique: true });

// Contact Log
const ContactLogSchema = new Schema({
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
  contactedAt: { type: Date, default: Date.now },
  contactedBy: { type: String, required: true },
  method: { type: String, enum: ['Phone', 'Email', 'SMS', 'WhatsApp'], required: true },
  status: { type: String, enum: ['Pending', 'Contacted', 'Failed', 'No Contacted'], default: 'No Contacted' },
  notes: { type: String, default: '' },
  org_id: { type: String, required: true },
});

// Message Templates
const MessageTemplateSchema = new Schema({
  category: { type: String, enum: ['message', 'confirmation'], default: 'message' },
  title: { type: String, required: true },
  content: { type: String, required: true },
  org_id: { type: String, required: true },
  createdBy: { type: String, required: true },
  variablesUsed: [{ type: String }],
}, { timestamps: true });

// Template Tokens
const TemplateTokenSchema = new Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  description: { type: String },
  field: { type: String, default: null },
  // Align with frontend typing: `secondLevelField`
  secondLevelField: { type: String, default: null },
  type: { type: String, enum: ['string', 'date', 'time', 'phone', 'custom'], default: 'string', required: true },
  org_id: { type: String },
  createdBy: { type: String },
}, { minimize: true });
// Para unicidad por clínica en lugar de global, podrías usar:
// TemplateTokenSchema.index({ org_id: 1, key: 1 }, { unique: true });

// TimeBlock
const TimeBlockSchema = new Schema({
  org_id: { type: String, required: true },
  blockNumber: { type: Number, required: true },
  label: { type: String, required: true },
  short: { type: String },
  from: { type: String, required: true },
  to: { type: String, required: true },
});

/* ======================= Export de modelos ======================= */

const getModel = require('./_getModel');

// Materializamos los modelos primero para poder ejecutar comprobaciones opcionales
const AppointmentModel = getModel('Appointment', AppointmentsSchema);
const CategoryModel = getModel('Category', CategoriesSchema);
const PriorityListModel = getModel('PriorityList', PrioritySchema);
const TimeBlockModel = getModel('TimeBlock', TimeBlockSchema);
const MessageLogModel = getModel('MessageLog', ContactLogSchema);
const TreatmentModel = getModel('Treatment', TreatmentSchema);
const ContactAppointmentModel = getModel('ContactAppointment', ContactSchema);
const ManualContactModel = getModel('ManualContact', ManualContactSchema);
const TemplateTokenModel = getModel('TemplateToken', TemplateTokenSchema);
const MessageTemplateModel = getModel('MessageTemplate', MessageTemplateSchema);
const MediaFileModel = getModel('MediaFile', MediaFileSchema);
const MessageModel = getModel('Message', MessageSchema);

// Salvaguarda opcional: elimina un índice único legado sobre phoneInput si existe.
// Actívalo estableciendo DROP_LEGACY_PHONEINPUT_UNIQUE=true en el entorno.
async function dropLegacyPhoneInputUniqueIndexIfAny() {
  if (process.env.DROP_LEGACY_PHONEINPUT_UNIQUE !== 'true') return;
  try {
    const indexes = await AppointmentModel.collection.indexes();
    const bad = indexes.find((ix) => ix?.name && ix.name.includes('phoneInput') && ix.unique);
    if (bad) {
      const name = bad.name;
      console.warn('[Appointment] Dropping legacy unique index on phoneInput:', name);
      await AppointmentModel.collection.dropIndex(name);
      console.warn('[Appointment] Dropped index:', name);
    }
  } catch (e) {
    console.warn('[Appointment] Could not drop legacy phoneInput unique index (safe to ignore if missing):', e?.message || e);
  }
}

// Ejecutar en background sin bloquear el arranque
setTimeout(() => { dropLegacyPhoneInputUniqueIndexIfAny(); }, 0);

module.exports = {
  toE164AU, // por si lo quieres usar en endpoints

  Appointment: AppointmentModel,
  Category: CategoryModel,
  PriorityList: PriorityListModel,
  TimeBlock: TimeBlockModel,
  MessageLog: MessageLogModel,
  Treatment: TreatmentModel,
  ContactAppointment: ContactAppointmentModel,
  ManualContact: ManualContactModel,
  TemplateToken: TemplateTokenModel,
  MessageTemplate: MessageTemplateModel,
  MediaFile: MediaFileModel,
  Message: MessageModel,
};
