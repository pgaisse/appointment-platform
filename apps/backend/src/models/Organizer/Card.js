const mongoose = require('mongoose');

const ChecklistItem = new mongoose.Schema(
  { id: String, text: String, done: Boolean },
  { _id: false }
);
const Attachment = new mongoose.Schema(
  { id: String, url: String, name: String },
  { _id: false }
);
const CommentItem = new mongoose.Schema(
  { id: String, text: String, createdAt: Date },
  { _id: false }
);

const CardSchema = new mongoose.Schema(
  {
    topicId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    columnId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Column', required: true },
    title:     { type: String, required: true },
    description: { type: String },
    sortKey:   { type: String, required: true },

    // Para evitar errores 400 ahora mismo, dejamos labels como Mixed (acepta string u objeto)
    labels:      { type: [mongoose.Schema.Types.Mixed], default: [] },
    members:     { type: [String], default: [] },
    dueDate:     { type: Date },

    checklist:   { type: [ChecklistItem], default: [] },
    attachments: { type: [Attachment], default: [] },
    comments:    { type: [CommentItem], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Card', CardSchema);
