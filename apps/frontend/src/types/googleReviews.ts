// apps/frontend/src/types/googleReviews.ts

export interface GoogleReviewSettings {
  _id?: string;
  org_id: string;
  enabled: boolean;
  googlePlaceId?: string;
  reviewUrl?: string;
  clinicName?: string;
  messageTemplate: string;
  preventDuplicateDays?: number;
  autoSendAfterConfirmed: boolean;
  delayHours: number;
  // Google OAuth fields
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
  lastSyncAt?: Date;
  updatedAt?: Date;
  createdAt?: Date;
}

export interface GoogleReviewRequest {
  _id: string;
  org_id: string;
  appointment?: {
    _id: string;
    nameInput?: string;
    lastNameInput?: string;
    phoneInput?: string;
    phoneE164?: string;
  };
  patient: {
    name: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  status: 'pending' | 'sent' | 'delivered' | 'clicked' | 'reviewed' | 'failed';
  requestedAt: Date;
  sentAt?: Date;
  clickedAt?: Date;
  reviewedAt?: Date;
  twilioMessageSid?: string;
  twilioStatus?: string;
  twilioErrorCode?: string;
  twilioErrorMessage?: string;
  reviewRating?: number;
  reviewText?: string;
  googleReviewId?: string;
  manuallyConfirmed?: boolean;
  confirmedBy?: string;
  confirmationNotes?: string;
}

export interface GoogleReviewHistory {
  history: GoogleReviewRequest[];
  total: number;
  limit: number;
  skip: number;
}
