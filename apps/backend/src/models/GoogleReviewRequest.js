const mongoose = require('mongoose');

const GoogleReviewRequestSchema = new mongoose.Schema({
  // Referencia al appointment
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
  },
  
  // Datos del paciente (snapshot para analytics)
  patient: {
    name: { type: String, required: true },
    lastName: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
  },
  
  // Tracking del request
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'clicked', 'reviewed'],
    default: 'pending',
  },
  
  // Timestamps de cada etapa
  requestedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  clickedAt: { type: Date },
  reviewedAt: { type: Date },
  
  // Twilio data
  twilioMessageSid: { type: String },
  twilioStatus: { type: String },
  twilioErrorCode: { type: String },
  twilioErrorMessage: { type: String },
  
  // Review data (de Google o manual)
  googleReviewId: { type: String },
  reviewRating: { type: Number, min: 1, max: 5 },
  reviewText: { type: String },
  
  // Manual confirmation
  manuallyConfirmed: { type: Boolean, default: false },
  confirmedBy: { type: String }, // Auth0 user ID
  notes: { type: String },
  
  // Organization
  org_id: { type: String, required: true, index: true },
  
}, { 
  timestamps: true,
  collection: 'google_review_requests'
});

// Indexes
GoogleReviewRequestSchema.index({ appointment: 1 });
GoogleReviewRequestSchema.index({ org_id: 1, status: 1 });
GoogleReviewRequestSchema.index({ 'patient.phone': 1, requestedAt: -1 });

module.exports = mongoose.models.GoogleReviewRequest || mongoose.model('GoogleReviewRequest', GoogleReviewRequestSchema);
