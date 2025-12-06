// apps/backend/src/models/GoogleReview.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * GoogleReview Model
 * Stores reviews synced from Google My Business API
 */
const GoogleReviewSchema = new Schema({
  // Organization reference
  org_id: { 
    type: String, 
    required: true, 
    index: true 
  },

  // Google Review Identifiers
  reviewId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  
  // Reviewer Information
  reviewer: {
    profilePhotoUrl: String,
    displayName: String,
    isAnonymous: { type: Boolean, default: false }
  },

  // Review Content
  starRating: {
    type: String,
    enum: ['STAR_RATING_UNSPECIFIED', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'],
    required: true
  },
  
  comment: {
    type: String,
    default: ''
  },

  // Dates
  createTime: {
    type: Date,
    required: true,
    index: true
  },
  
  updateTime: {
    type: Date,
    required: true
  },

  // Review Reply (from business)
  reviewReply: {
    comment: String,
    updateTime: Date
  },

  // Internal tracking
  syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Local metadata
  tags: [String],
  notes: String,
  flagged: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false,
    index: true
  },

  // Related appointment (if review was requested via system)
  relatedAppointment: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true
  },
  
  relatedReviewRequest: {
    type: Schema.Types.ObjectId,
    ref: 'GoogleReviewRequest',
    index: true
  }
}, {
  timestamps: true,
  collection: 'GoogleReviews'
});

// Compound indexes for efficient queries
GoogleReviewSchema.index({ org_id: 1, createTime: -1 });
GoogleReviewSchema.index({ org_id: 1, starRating: 1 });
GoogleReviewSchema.index({ org_id: 1, archived: 1, createTime: -1 });

// Virtual for numeric star rating
GoogleReviewSchema.virtual('numericRating').get(function() {
  const ratingMap = {
    'ONE': 1,
    'TWO': 2,
    'THREE': 3,
    'FOUR': 4,
    'FIVE': 5
  };
  return ratingMap[this.starRating] || 0;
});

// Helper method to check if review has reply
GoogleReviewSchema.methods.hasReply = function() {
  return !!this.reviewReply?.comment;
};

// Helper method to check if review is recent
GoogleReviewSchema.methods.isRecent = function(days = 7) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  return this.createTime >= daysAgo;
};

// Ensure virtuals are included in JSON
GoogleReviewSchema.set('toJSON', { virtuals: true });
GoogleReviewSchema.set('toObject', { virtuals: true });

const GoogleReview = mongoose.model('GoogleReview', GoogleReviewSchema);

module.exports = GoogleReview;
