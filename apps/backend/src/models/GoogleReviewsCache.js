const mongoose = require('mongoose');

const GoogleReviewsCacheSchema = new mongoose.Schema({
  org_id: {
    type: String,
    required: true,
    index: true,
  },
  cacheKey: {
    type: String,
    required: true,
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
});

// Compound index for efficient queries
GoogleReviewsCacheSchema.index({ org_id: 1, cacheKey: 1 });

// TTL index to auto-delete expired cache entries
GoogleReviewsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GoogleReviewsCache', GoogleReviewsCacheSchema);
