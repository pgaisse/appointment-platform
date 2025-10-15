const mongoose = require('mongoose');
const { ContactStatus, MsgType } = require("../constants");

// ---------- Utils ----------
function toE164AU(input) {
  const raw = String(input || "").replace(/[^\d+0-9]/g, "");

  // +61XXXXXXXXX
  if (/^\+61\d{9}$/.test(raw)) return raw;

  // 61XXXXXXXXX → +61XXXXXXXXX
  if (/^61\d{9}$/.test(raw)) return `+${raw}`;

  // 0XXXXXXXXX (10 dígitos) → +61XXXXXXXXX
  if (/^0\d{9}$/.test(raw)) return `+61${raw.slice(1)}`;

  throw new Error(`Número AU inválido: ${input}`);
}

// ---------- Priority ----------
const PrioritySchema = new mongoose.Schema({
  org_id: { type: String, required: true },
  id: { type: Number, required: true },
  description: { type: String, required: true },
  notes: { type: String, default: "" },
  durationHours: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
}, { collection: 'PriorityList' });

PrioritySchema.index({ org_id: 1, name: 1 }, { unique: true });
PrioritySchema.index({ org_id: 1, id: 1 }, { unique: true });

// ---------- Subdocs Citas ----------
const ProposedAppDateSchema = new mongoose.Schema({
  startDate: { type: Date },
  endDate: { type: Date },
  proposedBy: { type: String, enum: ["clinic", "patient", "system"], default: "clinic" },
  reason: { type: String },
  createdAt: { type: Date },
}, { _id: false });

const ConfirmationSchema = new mongoose.Schema({
  decision: {
    type: String,
    enum: ["confirmed", "declined", "reschedule", "unknown"],
    default: "unknown",
  },
  decidedAt: { type: Date },
  byMessageSid: { type: String },
  lateResponse: { type: Boolean, default: false },
}, { _id: false });

const SelectedAppDateSchema = new mongoose.Schema({
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NoContacted },
  rescheduleRequested: { type: Boolean, default: false },
  proposed: {
    startDate: { type: Date },
    endDate: { type: Date },
    proposedBy: { type: String, enum: ["clinic", "patient", "system"], default: "clinic" },
    reason: { type: String },
    createdAt: { type: Date },
  },
  confirmation: ConfirmationSchema,
}, { _id: true });

// ---------- Appointment ----------
const AppointmentsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  proxyAddress: String,
  contactPreference: { type: String, enum: ["call", "sms"], trim: true },
  unknown: Boolean,

  sid: String,
  lastMessage: Date,
  lastMessageInteraction: { type: String, default: "" },

  // Entrada original
  nameInput: String,
  lastNameInput: String,
  emailInput: String,
  phoneInput: { type: String, default: "", index: true },

  // Normalizados para unicidad
  phoneE164: { type: String, default: "", index: true },
  emailLower: { type: String, default: "", index: true },

  textAreaInput: String,

  treatment: { type: mongoose.Schema.Types.ObjectId, ref: "Treatment", default: null },
  priority: { type: mongoose.Schema.Types.ObjectId, ref: "PriorityList", default: null },
  note: String,
  color: String,

  user_id: String,
  org_id: { type: String, index: true },
  org_name: String,

  position: Number,
  contactMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "MessageLog" }],
  reschedule: { type: Boolean, default: false },

  selectedDates: {
    startDate: Date,
    endDate: Date,
    days: [{
      weekDay: String,
      timeBlocks: [{ type: mongoose.Schema.Types.ObjectId, ref: "TimeBlock" }],
    }],
  },

  selectedAppDates: { type: [SelectedAppDateSchema], default: [] },

  providers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Provider", default: [] }],
  providerNotes: { type: String, default: "" },
  isProviderLocked: { type: Boolean, default: false },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", default: null },
  chair: { type: mongoose.Schema.Types.ObjectId, ref: "Chair", default: null },
}, { timestamps: true });

// Normalización
AppointmentsSchema.pre("validate", function (next) {
  const raw = (this.phoneInput || "").trim();
  try {
    this.phoneE164 = raw ? toE164AU(raw) : "";
  } catch {
    this.phoneE164 = ""; // vacío → lo ignora el índice parcial
  }

  this.emailLower =
    typeof this.emailInput === "string" ? this.emailInput.trim().toLowerCase() : "";

  if (!Array.isArray(this.providers)) this.providers = [];
  if (this.provider && !this.providers.length) this.providers = [this.provider];

  next();
});

// Índices únicos
AppointmentsSchema.index(
  { org_id: 1, phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: "string", $ne: "" } } }
);

AppointmentsSchema.index(
  { org_id: 1, emailLower: 1 },
  {
    unique: true,
    partialFilterExpression: { emailLower: { $type: "string", $ne: "" } },
    collation: { locale: "en", strength: 2 },
  }
);

AppointmentsSchema.index(
  { org_id: 1, sid: 1 },
  { unique: true, partialFilterExpression: { sid: { $type: "string", $ne: "" } } }
);

// Índices de consulta
AppointmentsSchema.index({
  providers: 1,
  "selectedDates.startDate": 1,
  "selectedDates.endDate": 1,
  phoneInput: 1,
});

// ---------- Contact Appointment ----------
const ContactSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  org_id: String,
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NotStarted },
  startDate: { type: Date },
  endDate: { type: Date },
  context: String,
  cSid: String,
  pSid: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// ---------- Categories ----------
const CategoriesSchema = new mongoose.Schema({
  name: String,
  description: String,
  notes: String,
  durationHours: Number,
  color: String,
  id: Number,
  user_id: String,
  org_id: String,
}, { timestamps: true });

// ---------- Media File ----------
const MediaFileSchema = new mongoose.Schema({
  category: { type: String, required: true, enum: ['media', 'audio', 'video', 'document'], trim: true },
  filename: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  content_type: { type: String, required: true, trim: true },
  sid: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

// ---------- Manual Contact ----------
const ManualContactSchema = new mongoose.Schema({
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

// ---------- Messages ----------
const MessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  conversationId: { type: String, required: true, index: true },
  index: { type: Number, index: true, set: v => typeof v === "string" ? parseInt(v, 10) : v },
  sid: { type: String, required: true, index: true },
  userId: { type: String },
  author: { type: String, required: true }, // "patient" | "clinic"
  proxyAddress: { type: String },
  type: { type: String, enum: Object.values(MsgType), default: MsgType.Message },
  body: { type: String },
  media: [
    { url: { type: String, required: true }, type: { type: String }, size: { type: Number } }
  ],
  status: { type: String, enum: ["pending", "sent", "delivered", "read", "failed"], default: "pending" },
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  resolvedBySid: { type: String, index: true },
  respondsTo: { type: String, index: true },
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, index: 1 }, { unique: true });
MessageSchema.index({ sid: 1 }, { unique: true });
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// ---------- Treatment ----------
const TreatmentSchema = new mongoose.Schema({
  org_id: String,
  name: { type: String, required: true },
  duration: { type: Number, required: true },
  defaultDuration: { type: Number, default: null },
  icon: { type: String, required: true },
  minIcon: { type: String, required: true },
  color: { type: String, required: true },
  category: { type: String, default: "General" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

TreatmentSchema.index({ org_id: 1, name: 1 }, { unique: true });

// ---------- Contact Log ----------
const ContactLogSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  contactedAt: { type: Date, default: Date.now },
  contactedBy: { type: String, required: true },
  method: { type: String, enum: ['Phone', 'Email', 'SMS', 'WhatsApp'], required: true },
  status: { type: String, enum: ['Pending', 'Contacted', 'Failed', 'No Contacted'], default: 'No Contacted' },
  notes: { type: String, default: '' },
  org_id: { type: String, required: true },
});

// ---------- Message Templates ----------
const MessageTemplateSchema = new mongoose.Schema({
  category: { type: String, enum: ["message", "confirmation"], default: "message" },
  title: { type: String, required: true },
  content: { type: String, required: true },
  org_id: { type: String, required: true },
  createdBy: { type: String, required: true },
  variablesUsed: [{ type: String }],
}, { timestamps: true });

// ---------- Template Tokens ----------
const TemplateTokenSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // si quieres por clínica, cambia a índice compuesto org_id + key
  label: { type: String, required: true },
  description: { type: String },
  field: { type: String },
  secondLevelfield: { type: String },
  type: { type: String, enum: ['string', 'date', 'time', 'phone', 'custom'], default: 'string', required: true },
  org_id: { type: String },
  createdBy: { type: String }
});
// Para unicidad por clínica en lugar de global, usa:
// TemplateTokenSchema.index({ org_id: 1, key: 1 }, { unique: true });


// ---------- TimeBlock ----------
const TimeBlockSchema = new mongoose.Schema({
  org_id: { type: String, required: true },
  blockNumber: { type: Number, required: true },
  label: { type: String, required: true },
  short: { type: String },
  from: { type: String, required: true },
  to: { type: String, required: true },
});

// ---------- Export ----------
const getModel = require('./_getModel');

module.exports = {
  toE164AU: toE164AU, // por si lo quieres reutilizar en endpoints
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
