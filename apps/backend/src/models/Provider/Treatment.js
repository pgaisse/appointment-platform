// src/models/Treatment.js
// Placeholder for reference only. Replace with your real Treatment model.
const mongoose = require('mongoose');

const TreatmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  defaultDuration: { type: Number, default: 30 },
  requiredChairTags: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Treatment', TreatmentSchema);
