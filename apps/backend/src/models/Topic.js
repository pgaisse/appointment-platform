const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  key: { type: String },
  meta: { type: Object }
}, { timestamps: true });

const Topic = mongoose.model('Topic', TopicSchema);
module.exports = { Topic };
