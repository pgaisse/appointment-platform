# Google My Business API Integration Setup

This document explains how to set up the Google My Business API integration for automatic review tracking.

## Overview

The Google My Business API integration allows the system to:
- Automatically sync reviews from Google My Business
- Match reviews with sent review requests
- Update review status to "Reviewed" with ratings
- Track review analytics automatically

## Architecture

- **OAuth Flow**: Developer's Google Cloud project provides OAuth credentials
- **Multi-tenant**: Each clinic authorizes the app to access their Google My Business account
- **Automatic Sync**: Reviews are synced every 6 hours (can be triggered manually)
- **Matching Logic**: Reviews matched by patient name and date (within 30 days)

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Appointment Platform - Google Reviews")
3. Enable the following APIs:
   - **Google My Business API** (v4)
   - **My Business Account Management API** (v1)
   - **My Business Business Information API** (v1)

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in the application information:
   - **App name**: Appointment Platform
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/business.manage`
5. Add test users (optional for testing)
6. Save and continue

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: "Appointment Platform OAuth"
5. **Authorized redirect URIs**:
   ```
   https://dev.letsmarter.com:8443/api/google-reviews/oauth/callback
   https://yourdomain.com/api/google-reviews/oauth/callback
   ```
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 4. Configure Environment Variables

Add these variables to your backend environment:

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://dev.letsmarter.com:8443/api/google-reviews/oauth/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=https://dev.letsmarter.com:8443
```

**Docker Compose** (recommended):
```yaml
services:
  backend:
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=https://dev.letsmarter.com:8443/api/google-reviews/oauth/callback
      - FRONTEND_URL=https://dev.letsmarter.com:8443
```

### 5. Install Dependencies

The `googleapis` package is already installed. If needed:

```bash
cd apps/backend
npm install googleapis
```

## Usage

### For Clinic Administrators

1. Go to **Admin** > **Google Reviews** > **Google Business API** tab
2. Click **Connect with Google**
3. Sign in with the Google account that manages the clinic's Google My Business profile
4. Authorize the application to access reviews
5. Once connected, reviews will sync automatically every 6 hours
6. Use **Sync Now** button for manual sync

### API Endpoints

#### Public Endpoints (No Auth)
- `GET /api/google-reviews/oauth/callback` - OAuth callback (Google redirects here)

#### Protected Endpoints (Require Auth)
- `GET /api/google-reviews/connect-google` - Initiate OAuth flow
- `POST /api/google-reviews/disconnect-google` - Disconnect Google account
- `POST /api/google-reviews/sync-reviews` - Manual sync reviews

## How Review Matching Works

The system matches Google reviews with sent review requests using:

1. **Patient Name**: First name from reviewer must match request patient name (case-insensitive)
2. **Date Window**: Review created within 30 days after request sent
3. **Status**: Only matches requests that haven't been marked as "reviewed" yet
4. **Most Recent**: If multiple matches, uses most recent request

Example:
```javascript
// Review from Google
{
  reviewer: { displayName: "John Smith" },
  createTime: "2025-12-01T10:00:00Z",
  starRating: "FIVE"
}

// Matches with request
{
  patient: { name: "John", lastName: "Smith" },
  sentAt: "2025-11-28T15:30:00Z",
  status: "clicked"
}

// Result: Updates request to
{
  status: "reviewed",
  reviewedAt: "2025-12-01T10:00:00Z",
  reviewRating: 5,
  googleReviewId: "review_123"
}
```

## Automatic Sync Schedule

A cron job (to be implemented) will run every 6 hours to sync reviews for all connected organizations:

```javascript
// Recommended cron schedule: 0 */6 * * *
// Runs at: 00:00, 06:00, 12:00, 18:00 UTC
```

## Database Schema

### GoogleReviewSettings (Updated)

```javascript
{
  org_id: String,
  enabled: Boolean,
  reviewUrl: String,
  clinicName: String,
  messageTemplate: String,
  preventDuplicateDays: Number,
  
  // OAuth fields (new)
  googleAccessToken: String,      // encrypted, not returned by default
  googleRefreshToken: String,     // encrypted, not returned by default
  googleTokenExpiry: Number,      // Unix timestamp
  lastSyncAt: Date,               // Last successful sync
  
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Token Storage**: Access and refresh tokens stored encrypted in database
2. **Token Scope**: Only request `business.manage` scope (read-only for reviews)
3. **Token Refresh**: Automatically refresh expired tokens before API calls
4. **Not Returned**: Tokens not included in default API responses (use `select: false`)
5. **Organization Isolation**: Each org has separate OAuth tokens

## Troubleshooting

### "Google account not connected"
- User needs to click "Connect with Google" in the Google Business API tab
- Check that OAuth credentials are configured correctly

### "No Google My Business account found"
- User must have a Google My Business account
- User must be signed in with the correct Google account during OAuth

### "Failed to sync reviews"
- Check token expiry (automatically refreshed if expired)
- Verify Google My Business API is enabled
- Check API quotas in Google Cloud Console

### "No reviews matched"
- Review names must match patient names (at least first name)
- Reviews must be within 30 days of request sent date
- Check that requests have `sentAt` timestamp

## API Quotas

Google My Business API has the following default quotas:
- **Queries per day**: 50,000
- **Queries per 100 seconds**: 1,000

For a system with 100 clinics syncing every 6 hours:
- 100 clinics × 4 syncs/day = 400 API calls/day
- Well within quota limits

## Future Enhancements

1. **Cron Job**: Implement automatic 6-hour sync schedule
2. **Webhook**: Set up Google My Business webhooks for real-time notifications
3. **Multi-location**: Support clinics with multiple Google Business locations
4. **Review Responses**: Allow staff to respond to reviews through the platform
5. **Advanced Analytics**: Track review sentiment, common keywords, trends

## Support

For issues or questions:
- Check logs: `docker logs backend_dev --tail 100 | grep "Google"`
- Verify OAuth setup in Google Cloud Console
- Test OAuth flow manually by visiting `/api/google-reviews/connect-google`
