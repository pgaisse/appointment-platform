// src/schemas/representative.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const RepresentativeSchema = new Schema({
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' }, // FK al padre
  relationship: {
    type: String,
    enum: ['parent', 'legal_guardian', 'grandparent', 'sibling', 'carer', 'other'],
    default: 'parent'
  },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  verifiedBy: { type: String, default: '' },
  consentAt: { type: Date },
  notes: { type: String, default: '' },
}, { _id: false });

// 👇 Export default (CommonJS)
module.exports = RepresentativeSchema;
