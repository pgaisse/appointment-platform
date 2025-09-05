const mongoose = require('mongoose');

const LabelSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: {
      type: String,
      enum: ['green','yellow','orange','red','purple','blue','lime','sky','pink','gray','black'],
      required: true,
    },
  },
  { _id: false }
);

const TopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    key: { type: String },
    // opcional: catálogo de labels del tópico
    labels: { type: [LabelSchema], default: [] },
  },
  { timestamps: true } // no pongas versionKey aquí para evitar el error anterior
);

// ⬅️ exporta el MODELO directamente
module.exports = mongoose.model('Topic', TopicSchema);
