// models/ConversationRead.js
const mongoose = require('mongoose');

const ConversationReadSchema = new mongoose.Schema(
  {
    org_id: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    // Usamos index para cálculo O(1). Si tienes históricos sin index, ver fallback por fecha más abajo.
    lastReadIndex: { type: Number, default: -1, index: true },
    lastReadAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'conversation_reads' }
);

// Cada usuario tiene un único “read state” por conversación
ConversationReadSchema.index({ org_id: 1, conversationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ConversationRead', ConversationReadSchema);
