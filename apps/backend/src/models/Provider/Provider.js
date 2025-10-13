// src/models/Provider.js
const mongoose = require('mongoose');

const ProviderSchema = new mongoose.Schema({
  org_id: { type: String, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // optional link to Auth0 user
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  initials: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  ahpraNumber: { type: String, trim: true },
  avatarUrl: { type: String, trim: true },
  color: { type: String, trim: true },

  skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Treatment' }],

  // treatmentId -> minutes
  defaultDurations: { type: Map, of: Number, default: {} },

  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  chairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chair' }],

  defaultSlotMinutes: { type: Number, default: 10 },
  bufferBefore: { type: Number, default: 0 },
  bufferAfter: { type: Number, default: 0 },
  maxOverlap: { type: Number, default: 0 },

  acceptingNewPatients: { type: Boolean, default: true },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

ProviderSchema.index({ org_id: 1, isActive: 1, lastName: 1, firstName: 1 });

ProviderSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

module.exports = mongoose.model('Provider', ProviderSchema);
