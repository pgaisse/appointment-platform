const mongoose = require('mongoose');

const ColumnSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    title: { type: String, required: true },
    sortKey: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Column', ColumnSchema);
