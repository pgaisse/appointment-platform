// backend/src/models/Organizer/Card.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChecklistItemSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const AttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    url: { type: String, required: true },
    name: { type: String },
  },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CardSchema = new Schema(
  {
    topicId:  { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true, index: true },

    title:       { type: String, required: true, trim: true },
    description: { type: String },
    sortKey:     { type: Number, required: true, index: true },

    // labels se guardan como IDs (strings) del catálogo del tópico
    labels:   [{ type: String }],
    members:  [{ type: String }],
    dueDate:  { type: Date },

    checklist:   [ChecklistItemSchema],
    attachments: [AttachmentSchema],
    comments:    [CommentSchema],

    // ✅ nuevo flag para “completed”
    completed: { type: Boolean, default: false },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model('Card', CardSchema);
