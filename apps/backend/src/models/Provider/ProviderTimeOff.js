// src/models/ProviderTimeOff.js
const mongoose = require('mongoose');

const ProviderTimeOffSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
  kind: { type: String, enum: ['PTO', 'Sick', 'Course', 'PublicHoliday', 'Block'], required: true },
  start: { type: Date, required: true }, // UTC
  end:   { type: Date, required: true }, // UTC
  reason: { type: String, default: '' },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  chair:    { type: mongoose.Schema.Types.ObjectId, ref: 'Chair', default: null },
}, { timestamps: true });

ProviderTimeOffSchema.index({ provider: 1, start: 1, end: 1 });

module.exports = mongoose.model('ProviderTimeOff', ProviderTimeOffSchema);
