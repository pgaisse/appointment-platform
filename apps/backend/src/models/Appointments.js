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
}, { _id: false });

const SelectedAppDateSchema = new Schema({
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NoContacted },
  rescheduleRequested: { type: Boolean, default: false },
  proposed: {
    startDate: { type: Date },
    endDate: { type: Date },
    proposedBy: { type: String, enum: ['clinic', 'patient', 'system'], default: 'clinic' },
    reason: { type: String },
    createdAt: { type: Date },
  },
  confirmation: ConfirmationSchema,
}, { _id: true });

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
  phoneInput: { type: String, default: '', index: true },

  // Normalizados para unicidad
  phoneE164: { type: String, default: '', index: true },
  emailLower: { type: String, default: '', index: true },

  textAreaInput: String,

  treatment: { type: Schema.Types.ObjectId, ref: 'Treatment', default: null },
  priority: { type: Schema.Types.ObjectId, ref: 'PriorityList', default: null },
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

  providers: [{ type: Schema.Types.ObjectId, ref: 'Provider', default: [] }],
  providerNotes: { type: String, default: '' },
  isProviderLocked: { type: Boolean, default: false },
  location: { type: Schema.Types.ObjectId, ref: 'Location', default: null },
  chair: { type: Schema.Types.ObjectId, ref: 'Chair', default: null },
}, { timestamps: true });

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

  next();
});

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
  org_id: String,
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NotStarted },
  startDate: { type: Date },
  endDate: { type: Date },
  context: String,
  cSid: String,
  pSid: String,
  user: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

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
  field: { type: String },
  secondLevelfield: { type: String },
  type: { type: String, enum: ['string', 'date', 'time', 'phone', 'custom'], default: 'string', required: true },
  org_id: { type: String },
  createdBy: { type: String },
});
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

module.exports = {
  toE164AU, // por si lo quieres usar en endpoints

  Appointment: getModel('Appointment', AppointmentsSchema),
  Category: getModel('Category', CategoriesSchema),
  PriorityList: getModel('PriorityList', PrioritySchema),
  TimeBlock: getModel('TimeBlock', TimeBlockSchema),
  MessageLog: getModel('MessageLog', ContactLogSchema),
  Treatment: getModel('Treatment', TreatmentSchema),
  ContactAppointment: getModel('ContactAppointment', ContactSchema),
  ManualContact: getModel('ManualContact', ManualContactSchema),
  TemplateToken: getModel('TemplateToken', TemplateTokenSchema),
  MessageTemplate: getModel('MessageTemplate', MessageTemplateSchema),
  MediaFile: getModel('MediaFile', MediaFileSchema),
  Message: getModel('Message', MessageSchema),
};
