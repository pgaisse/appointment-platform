const mongoose = require('mongoose');
const { Schema } = mongoose;

const LabelSchema = new Schema({
  id:    { type: String, required: true },
  name:  { type: String, required: true },
  color: { type: String, required: true },
}, { _id: false });

const TopicSchema = new Schema({
  title: { type: String, required: true, trim: true },
  key:   { type: String, trim: true, index: true, sparse: true, unique: false }, // pon true si quieres unicidad global
  labels: [LabelSchema],
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);
