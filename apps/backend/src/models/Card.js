const mongoose = require('mongoose');

const ChecklistItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String },
  url: { type: String, required: true },
  mime: { type: String },
  size: { type: Number },
}, { _id: false });

const CommentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  authorId: { type: String },
  authorName: { type: String },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CardSchema = new mongoose.Schema({
  topicId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', index: true },
  columnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Column', required: true, index: true },
  title:    { type: String, required: true },
  description: { type: String },
  labels:   [{ type: String }],
  members:  [{ type: String }],
  dueDate:  { type: Date },
  coverUrl: { type: String },
  checklist: [ChecklistItemSchema],
  attachments: [AttachmentSchema],
  comments: [CommentSchema],
  params:   [{ key: String, value: mongoose.Schema.Types.Mixed }],
  sortKey:  { type: String, required: true, index: true },
}, { timestamps: true });

CardSchema.index({ topicId: 1, columnId: 1, sortKey: 1 });

const Card = mongoose.model('Card', CardSchema);
module.exports = { Card };
