const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

/**
 * ConversationChatCategory
 * - org_id: STRING (del JWT)
 * - conversationSid: CHxxxx (Twilio)
 * - chat_category_id: ref a ChatCategory (_id ObjectId)
 */
const ConversationChatCategorySchema = new Schema(
  {
    org_id:           { type: String, required: true, index: true },     // <- string
    conversationSid:  { type: String, required: true, index: true },     // CHxxxx
    chat_category_id: { type: Types.ObjectId, ref: "ChatCategory", required: true, index: true },
  },
  { timestamps: true, collection: "conversation_chat_categories" }
);

// Evita duplicar misma categoría en misma conversación y org
ConversationChatCategorySchema.index(
  { org_id: 1, conversationSid: 1, chat_category_id: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.ConversationChatCategory ||
  mongoose.model("ConversationChatCategory", ConversationChatCategorySchema);
