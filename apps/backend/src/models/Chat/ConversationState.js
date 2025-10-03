const mongoose = require('mongoose');

const ConversationStateSchema = new mongoose.Schema(
  {
    org_id: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'conversation_states' }
);

ConversationStateSchema.index({ org_id: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationState', ConversationStateSchema);