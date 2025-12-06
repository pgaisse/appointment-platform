const mongoose = require('mongoose');

const TwilioSettingsSchema = new mongoose.Schema({
  org_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Credenciales principales
  accountSid: {
    type: String,
    required: true,
    select: false, // No exponer por defecto en queries
  },
  authToken: {
    type: String,
    required: true,
    select: false, // Sensible, no exponer
  },
  
  // Configuración de mensajería
  messagingServiceSid: {
    type: String,
    required: false,
  },
  fromNumber: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^\+[1-9]\d{1,14}$/.test(v),
      message: 'Invalid phone number format (E.164 required, e.g., +61412345678)',
    },
  },
  
  // Conversaciones
  conversationsServiceSid: {
    type: String,
    required: false,
  },
  
  // Webhook Configuration
  webhookUrl: {
    type: String,
    required: false,
  },
  webhookEnabled: {
    type: Boolean,
    default: true,
  },
  webhookConfigured: {
    type: Boolean,
    default: false,
  },
  
  // Estado
  enabled: {
    type: Boolean,
    default: true,
  },
  validated: {
    type: Boolean,
    default: false,
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastValidatedAt: {
    type: Date,
  },
});

TwilioSettingsSchema.index({ org_id: 1 });

TwilioSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('TwilioSettings', TwilioSettingsSchema);
