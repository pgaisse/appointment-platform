const mongoose = require('mongoose');

const WebhookLogSchema = new mongoose.Schema({
  org_id: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  conversationSid: {
    type: String,
    index: true
  },
  messageSid: String,
  participantSid: String,
  author: String,
  body: String,
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'error', 'warning'],
    default: 'success',
    index: true
  },
  error: String,
  processingTimeMs: Number,
  ipAddress: String,
  userAgent: String,
  signatureValid: Boolean,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 2592000 // Auto-delete after 30 days
  }
});

// Compound indexes for common queries
WebhookLogSchema.index({ org_id: 1, createdAt: -1 });
WebhookLogSchema.index({ org_id: 1, eventType: 1, createdAt: -1 });
WebhookLogSchema.index({ org_id: 1, conversationSid: 1, createdAt: -1 });
WebhookLogSchema.index({ org_id: 1, status: 1, createdAt: -1 });

const WebhookLog = mongoose.model('WebhookLog', WebhookLogSchema);

module.exports = WebhookLog;
