const mongoose = require('mongoose');
const { Schema } = mongoose;

const LabelSchema = new Schema({
  id:    { type: String, required: true },
  name:  { type: String, required: true, trim: true },
  color: { type: String, required: true, trim: true },
  noColor: { type: Boolean, default: false }, // allow “no color” label
}, { _id: false });

const TopicAppearanceSchema = new Schema({
  background: {
    type: { type: String, enum: ['color', 'image'], default: 'color' },
    color: { type: String, default: '#0C0F17' },
    imageUrl: { type: String, default: '' },
  },
  overlay: {
    blur: { type: Number, default: 0 },
    brightness: { type: Number, default: 1 },
  }
}, { _id: false });

const TopicSchema = new Schema({
  title:  { type: String, required: true, trim: true },
  key:    { type: String, trim: true, index: true, sparse: true },
  labels: { type: [LabelSchema], default: [] },         // ✅ default
  appearance: { type: TopicAppearanceSchema, default: () => ({}) }, // ✅ default
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);
