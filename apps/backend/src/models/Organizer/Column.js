const mongoose = require('mongoose');
const { Schema } = mongoose;

const ColumnSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    title:   { type: String, required: true, trim: true },
    sortKey: { type: Number, required: true, index: true },
  },
  { timestamps: true } // NO pongas versionKey: false aquí (causaba error antes)
);

module.exports = mongoose.model('Column', ColumnSchema);
