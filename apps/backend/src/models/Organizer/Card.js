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
    text: { type: String, trim: true, required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { _id: true, versionKey: false }
);
const CoverSchema = new Schema({
  type: { type: String, enum: ['none', 'color', 'image'], default: 'none' },
  color: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  size: { type: String, enum: ['half', 'full'], default: 'half' },
}, { _id: false });

const CardSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String },

    sortKey: { type: Number, required: true, index: true },
    completed: { type: Boolean, default: false },

    // labels se guardan como IDs (strings) del catálogo del tópico
    labels: [{ type: String }],
    members: [{ type: String }],
    dueDate: { type: Date },

    checklist: [ChecklistItemSchema],
    attachments: [AttachmentSchema],
    comments: { type: [CommentSchema], default: [] },

    // ✅ nuevo flag para “completed”
    completed: { type: Boolean, default: false },
    cover: { type: CoverSchema, default: () => ({}) }, // ✅ new
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) { ret.id = ret._id; delete ret._id; return ret; },
    },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('Card', CardSchema);
