// apps/backend/src/models/GoogleReviewSettings.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const GoogleReviewSettingsSchema = new Schema({
  org_id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  enabled: { 
    type: Boolean, 
    default: false 
  },
  googlePlaceId: { 
    type: String, 
    required: false,
    trim: true 
  },
  reviewUrl: { 
    type: String, 
    required: false,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'reviewUrl must be a valid URL'
    }
  },
  clinicName: { 
    type: String, 
    default: '' 
  },
  messageTemplate: { 
    type: String, 
    default: "Hi {firstName}, thank you for visiting {clinicName}! We'd love to hear about your experience. Could you leave us a review? {reviewLink}"
  },
  preventDuplicateDays: {
    type: Number,
    default: 30,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 365;
      },
      message: 'preventDuplicateDays must be between 0 and 365'
    }
  },
  autoSendAfterConfirmed: { 
    type: Boolean, 
    default: false 
  },
  delayHours: { 
    type: Number, 
    default: 24,
    min: 0,
    max: 168 // 1 week max
  },
  // ━━━ Google OAuth Fields ━━━
  googleAccessToken: {
    type: String,
    required: false,
    select: false // Don't return by default for security
  },
  googleRefreshToken: {
    type: String,
    required: false,
    select: false // Don't return by default for security
  },
  googleTokenExpiry: {
    type: Number, // Unix timestamp
    required: false
  },
  lastSyncAt: {
    type: Date,
    required: false
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true 
  }
}, { 
  collection: 'GoogleReviewSettings',
  timestamps: true 
});

// Index for faster queries
GoogleReviewSettingsSchema.index({ org_id: 1 });

const GoogleReviewSettings = mongoose.model('GoogleReviewSettings', GoogleReviewSettingsSchema);

module.exports = GoogleReviewSettings;
