// src/models/Chair.js
const mongoose = require('mongoose');

const ChairSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
  tags: [{ type: String }], // e.g., 'XRAY', 'IV-Sedation'
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

ChairSchema.index({ location: 1, isActive: 1 });

module.exports = mongoose.model('Chair', ChairSchema);
