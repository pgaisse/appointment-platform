const mongoose = require('mongoose');
const { ContactStatus } = require("../constants")
// Priority Schema (subdocumento)
const PrioritySchema = new mongoose.Schema({
  org_id: {
    type: String,
    required: true,
  },
  id: {
    type: Number,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  notes: {
    type: String,
    default: "",
  },
  durationHours: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  }
}, { collection: 'PriorityList' }); // Para que cada prioridad tenga su propio _id

// Appointment Priority Schema (colección independiente)


// Appointment Schema
const AppointmentsSchema = new mongoose.Schema({
  sid: String,
  lastMessage: Date,
  lastMessageInteraction: { type: String, default: "" },
  nameInput: String,
  emailInput: String,
  phoneInput: String,
  lastNameInput: String,
  textAreaInput: String,
  treatment: { type: mongoose.Schema.Types.ObjectId, ref: 'Treatment', default: null },
  priority: { type: mongoose.Schema.Types.ObjectId, ref: 'PriorityList', default: null },
  note: String,
  color: String,
  user_id: String,
  org_id: String,
  org_name: String,
  position: Number,
  contactMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MessageLog' }],
  reschedule: { type: Boolean, default: false },
  selectedDates: {
    startDate: Date,
    endDate: Date,
    days: [
      {
        weekDay: String, // Ej: "Monday"
        timeBlocks: [
          { type: mongoose.Schema.Types.ObjectId, ref: 'TimeBlock' }
        ]
      }
    ]
  },
  selectedAppDates: [
    {
      status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NoContacted },
      contact: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactAppointment' },
      startDate: { type: Date },
      endDate: { type: Date },
      propStartDate: { type: Date },
      propEndDate: { type: Date },

    }
  ]
});
const CategoriesSchema = new mongoose.Schema({
  name: String,
  description: String,
  notes: String,
  durationHours: Number,
  color: String,
  id: Number,
  user_id: String,
  org_id: String,
});


const MediaFileSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, enum: ['media', 'audio', 'video', 'document'], trim: true, },
    filename: { type: String, required: true, trim: true, },
    size: { type: Number, required: true, },
    content_type: { type: String, required: true, trim: true, },
    sid: { type: String, required: true, unique: true, trim: true, },
  },
  {
    timestamps: true, // Crea automáticamente createdAt y updatedAt
  }
);


const ManualContactSchema = new mongoose.Schema(
  {
    nameInput: { type: String, required: true, trim: true, maxlength: 100 },
    lastNameInput: { type: String, required: true, trim: true, maxlength: 100 },
    phoneInput: { type: String, required: true },
    user_id: { type: String },
    org_id: { type: String },
    org_name: { type: String },
    sid: { type: String },
    lastMessage: Date,
    createdBy: { type: String },
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
  }
);

const ContactSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true, // recomendable si siempre debe tenerlo
  },
  status: { type: String, enum: Object.values(ContactStatus), default: ContactStatus.NotStarted },
  context: String,
  cSid: String,
  pSid: String,


});



const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,   // Twilio Conversation SID o tu propio ID de conversación
      required: true,
      index: true
    },
    index: {
      type:String,
      index:true
    },
    sid: {
      type: String,   // Twilio Message SID (ej: "IMXXXX")
      required: true,
      index: true
    },
    author: {
      type: String,   // "patient" | "clinic"
      required: true
    },

    // Contenido del mensaje
    body: {
      type: String    // Puede ser null si es solo multimedia
    },
    media: [          // Puede estar vacío si es solo texto
      {
        url: { type: String, required: true }, // URL al storage (S3, GDrive, etc.)
        type: { type: String },                // MIME ej: "image/png", "application/pdf"
        size: { type: Number }                 // opcional: peso en bytes
      }
    ],

    // Estado y control
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending"
    },
    direction: {
      type: String,
      enum: ["inbound", "outbound"], // recibido o enviado
      required: true
    }
  },
  { timestamps: true } // agrega createdAt y updatedAt
);

const TreatmentSchema = new mongoose.Schema({
  org_id: String,
  name: {
    type: String,
    required: true,
    unique: true, // evita duplicados
  },
  duration: {
    type: Number, // en minutos
    required: true,
  },
  icon: {
    type: String, // nombre del icono o identificador
    required: true,
  },
  minIcon: {
    type: String, // nombre del icono o identificador
    required: true,
  },
  color: {
    type: String, // ejemplo: "#EDF2F7" o "blue.100"
    required: true,
  },
  category: {
    type: String, // opcional: estética, cirugía, general, etc.
    default: "General",
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true, // createdAt, updatedAt
});

const ContactLogSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  contactedAt: { type: Date, default: Date.now },
  contactedBy: { type: String, required: true }, // user_id o nombre del staff
  method: { type: String, enum: ['Phone', 'Email', 'SMS', 'WhatsApp'], required: true },
  status: { type: String, enum: ['Pending', 'Contacted', 'Failed', 'No Contacted'], default: 'No Contacted' },
  notes: { type: String, default: '' },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  org_id: { type: String, required: true },

});


const MessageTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    org_id: { type: String, required: true },
    createdBy: { type: String, required: true },
    variablesUsed: [{ type: String }] // ej: ["#patient", "#date"]
  },
  { timestamps: true }
);
const TemplateTokenSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // ej: "#patient"
  label: { type: String, required: true },             // ej: "Patient Name"
  description: { type: String },
  field: { type: String },
  secondLevelfield: { type: String },
  type: {
    type: String,
    enum: ['string', 'date', 'time', 'phone', 'custom'],
    default: 'string',
    required: true
  },
  org_id: { type: String },      // opcional si los tokens son por clínica
  createdBy: { type: String }    // opcional si los usuarios crean tokens
});


const TimeBlockSchema = new mongoose.Schema({
  org_id: { type: String, required: true }, // Organización que define estos bloques
  blockNumber: { type: Number, required: true }, // 1, 2, 3, 4...
  label: { type: String, required: true },       // Ej: 'Early Morning'
  short: { type: String },                       // Ej: 'EMor'
  from: { type: String, required: true },        // Ej: '09:30'
  to: { type: String, required: true },          // Ej: '11:30'
});
// Exportar modelos con nombres plurales (coinciden con `ref` en AppointmentSchema)
module.exports = {
  Appointment: mongoose.model('Appointment', AppointmentsSchema),
  Category: mongoose.model('Category', CategoriesSchema),
  PriorityList: mongoose.model('PriorityList', PrioritySchema),
  TimeBlock: mongoose.model('TimeBlock', TimeBlockSchema),
  MessageLog: mongoose.model('MessageLog', ContactLogSchema),
  Treatment: mongoose.model('Treatment', TreatmentSchema),
  ContactAppointment: mongoose.model("ContactAppointment", ContactSchema),
  ManualContact: mongoose.model("ManualContact", ManualContactSchema),
  TemplateToken: mongoose.model("TemplateToken", TemplateTokenSchema),
  MessageTemplate: mongoose.model("MessageTemplate", MessageTemplateSchema),
  MediaFile: mongoose.model("MediaFile", MediaFileSchema),
  Message: mongoose.model("Message", MessageSchema)
};
