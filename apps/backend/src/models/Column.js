const mongoose = require('mongoose');

const ColumnSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  title: { type: String, required: true },
  sortKey: { type: String, index: true },
  meta: { type: Object }
}, { timestamps: true });

const Column = mongoose.model('Column', ColumnSchema);
module.exports = { Column };
