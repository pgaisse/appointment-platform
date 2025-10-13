// src/models/Location.js
const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '' },
  timezone: { type: String, default: 'Australia/Sydney' },
  phone: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

LocationSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Location', LocationSchema);
