// models/ConversationState.js
const mongoose = require('mongoose');

const ConversationStateSchema = new mongoose.Schema(
  {
    org_id: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },

    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    archivedBy: { type: String }, // sub del usuario que la archivó

    // futuro: pinned, muted, etc.
  },
  { timestamps: true, collection: 'conversation_states' }
);

ConversationStateSchema.index({ org_id: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationState', ConversationStateSchema);
