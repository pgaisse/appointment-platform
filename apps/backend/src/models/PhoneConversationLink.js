// models/PhoneConversationLink.js
const mongoose = require('mongoose');

const PhoneConversationLinkSchema = new mongoose.Schema({
  org_id: { type: String, required: true, index: true },
  phoneE164: { type: String, required: true, index: true },
  conversationSid: { type: String, required: true },
  proxyAddress: { type: String, required: true },
}, { timestamps: true });

PhoneConversationLinkSchema.index({ org_id: 1, phoneE164: 1 }, { unique: true });
PhoneConversationLinkSchema.index({ org_id: 1, conversationSid: 1 }, { unique: true });

module.exports = mongoose.model('PhoneConversationLink', PhoneConversationLinkSchema);
