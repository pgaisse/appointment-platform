// apps/backend/src/routes/google-reviews.js
const express = require('express');
const router = express.Router();
const GoogleReviewSettings = require('../models/GoogleReviewSettings');
const GoogleReviewRequest = require('../models/GoogleReviewRequest');
const GoogleReviewsCache = require('../models/GoogleReviewsCache');
const { Appointment } = require('../models/Appointments');
const Organization = require('../models/Enviroment/Org');
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth'); 
const { requireAnyPermissionExplain } = require('../middleware/rbac-explain');
const helpers = require('../helpers');
const TwilioService = require('../services/TwilioService');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE HELPER FUNCTIONS (Persistent MongoDB Cache)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get cached data if not expired
 */
async function getCachedData(org_id, cacheKey) {
  try {
    const cached = await GoogleReviewsCache.findOne({
      org_id,
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();
    
    if (cached) {
      const ageSeconds = Math.floor((Date.now() - cached.createdAt.getTime()) / 1000);
      console.log(`📦 [Cache HIT] ${cacheKey} for org ${org_id} (age: ${ageSeconds}s)`);
      return {
        data: cached.data,
        cached: true,
        cacheAge: ageSeconds,
      };
    }
    
    console.log(`📦 [Cache MISS] ${cacheKey} for org ${org_id}`);
    return null;
  } catch (error) {
    console.error('❌ [Cache GET Error]:', error);
    return null;
  }
}

/**
 * Set cached data with TTL
 */
async function setCachedData(org_id, cacheKey, data, ttlMinutes = 30) {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    await GoogleReviewsCache.findOneAndUpdate(
      { org_id, cacheKey },
      { 
        data, 
        expiresAt,
        createdAt: new Date(),
      },
      { upsert: true }
    );
    
    console.log(`💾 [Cache SET] ${cacheKey} for org ${org_id}, TTL: ${ttlMinutes}m`);
    return true;
  } catch (error) {
    console.error('❌ [Cache SET Error]:', error);
    return false;
  }
}

/**
 * Get stale cache (even if expired) as fallback
 */
async function getStaleCachedData(org_id, cacheKey) {
  try {
    const cached = await GoogleReviewsCache.findOne({
      org_id,
      cacheKey,
    }).sort({ createdAt: -1 }).lean();
    
    if (cached) {
      const ageSeconds = Math.floor((Date.now() - cached.createdAt.getTime()) / 1000);
      console.log(`🗄️ [Cache STALE] ${cacheKey} for org ${org_id} (age: ${ageSeconds}s)`);
      return {
        data: cached.data,
        cached: true,
        stale: true,
        cacheAge: ageSeconds,
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ [Cache GET STALE Error]:', error);
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC ENDPOINTS (NO AUTH) - MOVED TO index.js for maximum speed
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// These endpoints are now defined directly in index.js BEFORE all middlewares
// to ensure fastest possible response time for patient review links
//
// - GET /api/google-reviews/click/:requestId
// - GET /api/google-reviews/review-page/:requestId
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/google-reviews/track-google-click/:requestId
 * Track when user clicks "Continue with Google" - NO AUTH REQUIRED
 */
router.post('/track-google-click/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const reviewRequest = await GoogleReviewRequest.findById(requestId);

    if (!reviewRequest) {
      return res.status(404).json({ error: 'Review request not found' });
    }

    // Update status to indicate they proceeded to Google
    reviewRequest.status = 'clicked';
    if (!reviewRequest.clickedAt) {
      reviewRequest.clickedAt = new Date();
    }
    await reviewRequest.save();

    console.log('✅ [POST /google-reviews/track-google-click] User clicked Continue with Google:', reviewRequest.patient.name);

    return res.json({ success: true });

  } catch (error) {
    console.error('❌ [POST /google-reviews/track-google-click] Error:', error);
    return res.status(500).json({ error: 'An error occurred' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GOOGLE OAUTH ENDPOINTS (Partially Public)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { google } = require('googleapis');

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.API_BASE_URL || 'https://dev.letsmarter.com:8443'}/api/google-reviews/oauth/callback`;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/**
 * GET /api/google-reviews/connect-google
 * Initiate Google OAuth Flow - Token in query param (for browser redirects)
 */
router.get('/connect-google', async (req, res) => {
  try {
    console.log('🔗 [Google OAuth] /connect-google endpoint hit');
    console.log('🔗 [Google OAuth] Query params:', Object.keys(req.query));
    console.log('🔗 [Google OAuth] Token present:', !!req.query.token);
    
    const tokenFromQuery = req.query.token;
    
    if (!tokenFromQuery) {
      console.log('❌ [Google OAuth] No token in query params');
      return res.status(401).json({ error: 'Authentication token required' });
    }

    // Validate token and get org_id
    let org_id;
    try {
      const tokenInfo = await helpers.getTokenInfo(`Bearer ${tokenFromQuery}`);
      org_id = tokenInfo.org_id;
      
      if (!org_id) {
        console.error('❌ [Google OAuth] No org_id in token');
        return res.status(400).json({ error: 'Organization ID not found in token' });
      }
    } catch (error) {
      console.error('❌ [Google OAuth] Token validation failed:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Google OAuth not configured',
        message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables' 
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/business.manage'],
      state: org_id,
      prompt: 'consent'
    });

    console.log(`🔗 [Google OAuth] Redirecting org ${org_id} to Google auth`);
    res.redirect(authUrl);

  } catch (error) {
    console.error('❌ [Google OAuth] Error:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth', message: error.message });
  }
});

/**
 * GET /api/google-reviews/oauth/callback
 * OAuth Callback - NO AUTH REQUIRED (Google redirects here)
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state: org_id } = req.query;
    console.log('🔄 [OAuth Callback] Received callback - code:', !!code, 'org_id:', org_id);

    if (!code || !org_id) {
      console.error('❌ [OAuth Callback] Missing code or org_id');
      const frontendUrl = process.env.FRONTEND_URL || 'https://dev.letsmarter.com:8443';
      return res.redirect(`${frontendUrl}/settings?error=oauth_failed&reason=missing_params`);
    }

    console.log('🔄 [OAuth Callback] Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('✅ [OAuth Callback] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope
    });

    console.log('💾 [OAuth Callback] Saving tokens to database...');
    const updated = await GoogleReviewSettings.findOneAndUpdate(
      { org_id },
      {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date,
        enabled: true,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log('✅ [OAuth Callback] Tokens saved successfully for org:', org_id);
    console.log('✅ [OAuth Callback] Settings updated:', {
      _id: updated._id,
      org_id: updated.org_id,
      enabled: updated.enabled,
      hasTokens: !!updated.googleAccessToken
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://dev.letsmarter.com:8443';
    res.redirect(`${frontendUrl}/settings?connected=true&tab=5`);

  } catch (error) {
    console.error('❌ [OAuth Callback] Error:', error);
    console.error('❌ [OAuth Callback] Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    const frontendUrl = process.env.FRONTEND_URL || 'https://dev.letsmarter.com:8443';
    res.redirect(`${frontendUrl}/settings?error=oauth_failed&reason=${encodeURIComponent(error.message)}`);
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROTECTED ENDPOINTS - Require authentication
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Apply auth middleware to all remaining routes
router.use(jwtCheck, attachUserInfo, ensureUser);

/**
 * GET /api/google-reviews/debug/connection-status
 * Diagnostic endpoint to check Google My Business connection status
 */
router.get(
  '/debug/connection-status',
  requireAnyPermissionExplain('settings:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      console.log('🔍 [DEBUG] Checking connection status for org:', org_id);
      
      // Check if settings exist
      const settings = await GoogleReviewSettings.findOne({ org_id })
        .select('+googleAccessToken +googleRefreshToken +googleTokenExpiry');
      
      if (!settings) {
        console.log('⚠️ [DEBUG] No settings found for org:', org_id);
        return res.json({
          connected: false,
          reason: 'No settings found',
          org_id,
        });
      }
      
      const tokenInfo = {
        hasAccessToken: !!settings.googleAccessToken,
        hasRefreshToken: !!settings.googleRefreshToken,
        tokenExpiry: settings.googleTokenExpiry,
        isExpired: settings.googleTokenExpiry ? new Date(settings.googleTokenExpiry) < new Date() : null,
        enabled: settings.enabled,
      };
      
      console.log('🔍 [DEBUG] Settings found:', tokenInfo);
      
      // Check if tokens exist
      if (!settings.googleAccessToken) {
        return res.json({
          connected: false,
          reason: 'No access token',
          org_id,
          tokenInfo,
        });
      }
      
      // Try to make a test API call to verify tokens work
      try {
        gmbService.oauth2Client.setCredentials({
          access_token: settings.googleAccessToken,
          refresh_token: settings.googleRefreshToken,
          expiry_date: settings.googleTokenExpiry,
        });
        
        console.log('🔍 [DEBUG] Testing API connection...');
        const testResponse = await gmbService.oauth2Client.request({
          url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        });
        
        const accounts = testResponse.data.accounts || [];
        console.log('✅ [DEBUG] API call successful, found', accounts.length, 'accounts');
        
        return res.json({
          connected: true,
          org_id,
          accountCount: accounts.length,
          accounts: accounts.map(acc => ({ name: acc.name, type: acc.type })),
          tokenInfo,
        });
      } catch (apiError) {
        console.error('❌ [DEBUG] API call failed:', apiError.response?.data || apiError.message);
        
        return res.json({
          connected: false,
          reason: 'API call failed',
          error: apiError.response?.data?.error || apiError.message,
          statusCode: apiError.response?.status,
          org_id,
          tokenInfo,
        });
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error in connection-status:', error);
      res.status(500).json({
        error: 'Failed to check connection status',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/google-reviews/settings
 * Get Google Review settings for the organization
 */
router.get(
  '/settings',
  requireAnyPermissionExplain('settings:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      // Include OAuth tokens in response (normally select: false)
      let settings = await GoogleReviewSettings.findOne({ org_id })
        .select('+googleAccessToken +googleRefreshToken +googleTokenExpiry')
        .lean();
      
      // If no settings exist, return default values
      if (!settings) {
        settings = {
          org_id,
          enabled: false,
          googlePlaceId: '',
          reviewUrl: '',
          messageTemplate: "Hi {firstName}, thank you for visiting {clinicName}! We'd love to hear about your experience. Could you leave us a review? {reviewLink}",
          autoSendAfterConfirmed: false,
          delayHours: 24
        };
      }

      console.log('✅ [GET /google-reviews/settings] Retrieved settings for org:', org_id);
      console.log('📊 [GET /google-reviews/settings] Has OAuth token:', !!settings.googleAccessToken);
      return res.json(settings);
    } catch (error) {
      console.error('❌ [GET /google-reviews/settings] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve settings' });
    }
  }
);

/**
 * PATCH /api/google-reviews/settings
 * Update Google Review settings for the organization
 */
router.patch(
  '/settings',
  requireAnyPermissionExplain('settings:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { enabled, googlePlaceId, reviewUrl, clinicName, messageTemplate, preventDuplicateDays, autoSendAfterConfirmed, delayHours } = req.body;

      // Validate preventDuplicateDays if provided
      if (preventDuplicateDays !== undefined && (preventDuplicateDays < 0 || preventDuplicateDays > 365)) {
        return res.status(400).json({ error: 'preventDuplicateDays must be between 0 and 365' });
      }

      // Validate delayHours if provided
      if (delayHours !== undefined && (delayHours < 0 || delayHours > 168)) {
        return res.status(400).json({ error: 'delayHours must be between 0 and 168' });
      }

      const updateData = {
        updatedAt: new Date()
      };

      if (enabled !== undefined) updateData.enabled = enabled;
      if (googlePlaceId !== undefined) updateData.googlePlaceId = googlePlaceId.trim();
      if (reviewUrl !== undefined) updateData.reviewUrl = reviewUrl.trim();
      if (clinicName !== undefined) updateData.clinicName = clinicName.trim();
      if (messageTemplate !== undefined) updateData.messageTemplate = messageTemplate;
      if (preventDuplicateDays !== undefined) updateData.preventDuplicateDays = preventDuplicateDays;
      if (autoSendAfterConfirmed !== undefined) updateData.autoSendAfterConfirmed = autoSendAfterConfirmed;
      if (delayHours !== undefined) updateData.delayHours = delayHours;

      const settings = await GoogleReviewSettings.findOneAndUpdate(
        { org_id },
        { $set: updateData },
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );

      console.log('✅ [PATCH /google-reviews/settings] Updated settings for org:', org_id);
      return res.json(settings);
    } catch (error) {
      console.error('❌ [PATCH /google-reviews/settings] Error:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

/**
 * POST /api/google-reviews/disconnect-google
 * Disconnect Google My Business account
 */
router.post(
  '/disconnect-google',
  requireAnyPermissionExplain('settings:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      await GoogleReviewSettings.updateOne(
        { org_id },
        {
          $unset: {
            googleAccessToken: '',
            googleRefreshToken: '',
            googleTokenExpiry: '',
            lastSyncAt: ''
          }
        }
      );

      console.log(`🔌 [Google OAuth] Disconnected for org: ${org_id}`);
      res.json({ success: true, message: 'Disconnected successfully' });

    } catch (error) {
      console.error('❌ [Disconnect Google] Error:', error);
      res.status(500).json({ error: 'Failed to disconnect' });
    }
  }
);

/**
 * POST /api/google-reviews/sync-reviews
 * Manual sync reviews from Google My Business
 */
router.post(
  '/sync-reviews',
  requireAnyPermissionExplain('settings:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const settings = await GoogleReviewSettings.findOne({ org_id }).select('+googleAccessToken +googleRefreshToken');

      if (!settings?.googleAccessToken) {
        return res.status(400).json({ error: 'Google account not connected' });
      }

      console.log(`🔄 [Sync Reviews] Starting sync for org: ${org_id}`);

      // Set credentials
      oauth2Client.setCredentials({
        access_token: settings.googleAccessToken,
        refresh_token: settings.googleRefreshToken,
        expiry_date: settings.googleTokenExpiry
      });

      // Refresh token if expired
      if (settings.googleTokenExpiry < Date.now()) {
        console.log('🔄 [Sync Reviews] Token expired, refreshing...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        await GoogleReviewSettings.updateOne(
          { org_id },
          {
            googleAccessToken: credentials.access_token,
            googleTokenExpiry: credentials.expiry_date
          }
        );
        oauth2Client.setCredentials(credentials);
      }

      // Fetch reviews from Google My Business
      const mybusinessAccountManagement = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
      
      // Get account
      const accountsResponse = await mybusinessAccountManagement.accounts.list();
      const accountName = accountsResponse.data.accounts?.[0]?.name;

      if (!accountName) {
        return res.status(404).json({ error: 'No Google My Business account found' });
      }

      console.log(`📊 [Sync Reviews] Found account: ${accountName}`);

      // Get locations
      const mybusinessBusinessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });
      const locationsResponse = await mybusinessBusinessInfo.accounts.locations.list({ parent: accountName });
      
      const location = locationsResponse.data.locations?.[0];

      if (!location) {
        return res.status(404).json({ error: 'No business location found' });
      }

      console.log(`📍 [Sync Reviews] Found location: ${location.name}`);

      // Get reviews (using v4 API for reviews)
      const mybusiness = google.mybusiness({ version: 'v4', auth: oauth2Client });
      const reviewsResponse = await mybusiness.accounts.locations.reviews.list({ parent: location.name });

      const reviews = reviewsResponse.data.reviews || [];

      console.log(`📊 [Sync Reviews] Found ${reviews.length} reviews from Google`);

      // Match reviews with requests
      const matched = await matchReviewsWithRequests(org_id, reviews);

      // Update last sync time
      await GoogleReviewSettings.updateOne({ org_id }, { lastSyncAt: new Date() });

      console.log(`✅ [Sync Reviews] Matched ${matched} reviews for org: ${org_id}`);

      res.json({ 
        success: true, 
        totalReviews: reviews.length,
        matched 
      });

    } catch (error) {
      console.error('❌ [Sync Reviews] Error:', error);
      res.status(500).json({ 
        error: 'Failed to sync reviews',
        message: error.message 
      });
    }
  }
);

// Helper function to match reviews with requests
async function matchReviewsWithRequests(org_id, reviews) {
  let matchedCount = 0;

  for (const review of reviews) {
    const reviewerName = review.reviewer?.displayName;
    const reviewTime = new Date(review.createTime);
    const rating = review.starRating === 'FIVE' ? 5 : 
                   review.starRating === 'FOUR' ? 4 :
                   review.starRating === 'THREE' ? 3 :
                   review.starRating === 'TWO' ? 2 : 1;

    if (!reviewerName) continue;

    // Find matching request (within 30 days, same patient name)
    const request = await GoogleReviewRequest.findOne({
      org_id,
      'patient.name': { $regex: new RegExp(reviewerName.split(' ')[0], 'i') },
      sentAt: { 
        $gte: new Date(reviewTime.getTime() - 30 * 24 * 60 * 60 * 1000),
        $lte: reviewTime
      },
      status: { $ne: 'reviewed' }
    }).sort({ sentAt: -1 });

    if (request) {
      await GoogleReviewRequest.updateOne(
        { _id: request._id },
        {
          status: 'reviewed',
          reviewedAt: reviewTime,
          reviewRating: rating,
          googleReviewId: review.reviewId
        }
      );
      matchedCount++;
      console.log(`✅ [Match] Matched review from ${reviewerName} with request ${request._id}`);
    }
  }

  return matchedCount;
}

/**
 * POST /api/google-reviews/send
 * Send a Google Review request to a patient
 */
router.post(
  '/send',
  requireAnyPermissionExplain('appointment:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { appointmentId } = req.body;
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');

      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      if (!appointmentId) {
        return res.status(400).json({ error: 'appointmentId is required' });
      }

      console.log('📨 [POST /google-reviews/send] Processing request for appointment:', appointmentId);

      // 1. Get Google Review settings
      const settings = await GoogleReviewSettings.findOne({ org_id });
      
      if (!settings || !settings.enabled) {
        console.warn('⚠️ Google Reviews not enabled for org:', org_id);
        return res.status(400).json({ error: 'Google Reviews are not enabled for your organization' });
      }

      if (!settings.reviewUrl || !settings.reviewUrl.trim()) {
        console.warn('⚠️ Review URL not configured for org:', org_id);
        return res.status(400).json({ error: 'Review URL is not configured. Please update settings.' });
      }

      // 2. Get appointment data
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        console.warn('⚠️ Appointment not found:', appointmentId);
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (!appointment.phoneE164 && !appointment.phoneInput) {
        console.warn('⚠️ No phone number for appointment:', appointmentId);
        return res.status(400).json({ error: 'Patient has no phone number' });
      }

      // 3. Check for duplicate requests (except if last was failed)
      const patientPhone = appointment.phoneE164 || appointment.phoneInput;
      const preventDays = settings.preventDuplicateDays;

      // ✅ Si preventDuplicateDays es 0 o no está configurado, NO hay restricción de tiempo
      if (preventDays && preventDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - preventDays);

        const recentRequest = await GoogleReviewRequest.findOne({
          org_id,
          'patient.phone': patientPhone,
          requestedAt: { $gte: cutoffDate }
        }).sort({ requestedAt: -1 });

        // ✅ Allow retry if the last request failed
        if (recentRequest && recentRequest.status !== 'failed') {
          console.warn('⚠️ Duplicate request prevented. Last request:', recentRequest.requestedAt, 'Status:', recentRequest.status);
          return res.status(400).json({ 
            error: `A review request was already sent to this patient within the last ${preventDays} days`,
            lastRequestDate: recentRequest.requestedAt,
            lastStatus: recentRequest.status
          });
        }

        // ✅ If retrying a failed request, log it
        if (recentRequest && recentRequest.status === 'failed') {
          console.log('🔄 Retrying failed review request for patient:', patientPhone);
        }
      } else {
        console.log('ℹ️ [POST /google-reviews/send] No time restriction - preventDuplicateDays is 0 or disabled');
      }

      // 4. Personalize message
      const firstName = appointment.nameInput || 'there';
      const lastName = appointment.lastNameInput || '';
      const clinicName = settings.clinicName || 'our clinic';
      
      // Create tracking link
      const reviewRequest = new GoogleReviewRequest({
        org_id,
        appointment: appointment._id,
        patient: {
          name: appointment.nameInput || '',
          lastName: appointment.lastNameInput || '',
          phone: patientPhone,
          email: appointment.email || ''
        },
        status: 'pending',
        requestedAt: new Date()
      });
      
      await reviewRequest.save();
      
      // Build tracking URL - debe apuntar al BACKEND
      const apiBaseUrl = process.env.API_BASE_URL || 'https://dev.letsmarter.com:8443';
      const trackingUrl = `${apiBaseUrl}/api/google-reviews/click/${reviewRequest._id}`;
      
      console.log(`🔗 [Google Reviews] Tracking URL: ${trackingUrl}`);
      
      const message = settings.messageTemplate
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{lastName\}/g, lastName)
        .replace(/\{clinicName\}/g, clinicName)
        .replace(/\{reviewLink\}/g, trackingUrl);

      console.log('📝 [POST /google-reviews/send] Message prepared:', {
        to: patientPhone,
        length: message.length,
        trackingUrl
      });

      // 5. Send SMS via Twilio - obtener cliente desde la base de datos
      const { client: twilioClient, settings: twilioSettings } = await TwilioService.getClient(org_id);
      const fromNumber = twilioSettings.fromNumber;
      
      if (!fromNumber) {
        return res.status(500).json({ 
          error: 'Twilio not configured', 
          message: 'No from number configured for this organization' 
        });
      }
      
      console.log("TwilioClient:", twilioClient);
      try {
        const twilioMessage = await twilioClient.messages.create({
          body: message,
          from: fromNumber,
          to: patientPhone
        });

        reviewRequest.twilioMessageSid = twilioMessage.sid;
        reviewRequest.twilioStatus = twilioMessage.status;
        reviewRequest.status = 'sent';
        reviewRequest.sentAt = new Date();
        
        await reviewRequest.save();
        
        console.log('✅ [POST /google-reviews/send] SMS sent successfully:', twilioMessage.sid);

        return res.json({ 
          success: true, 
          messageSid: twilioMessage.sid,
          requestId: reviewRequest._id,
          message: 'Review request sent successfully'
        });

      } catch (twilioError) {
        console.error('❌ [POST /google-reviews/send] Twilio error:', twilioError);
        
        reviewRequest.status = 'failed';
        reviewRequest.twilioErrorCode = twilioError.code;
        reviewRequest.twilioErrorMessage = twilioError.message;
        await reviewRequest.save();

        return res.status(500).json({ 
          error: 'Failed to send SMS', 
          details: twilioError.message 
        });
      }

    } catch (error) {
      console.error('❌ [POST /google-reviews/send] Error:', error);
      return res.status(500).json({ error: 'Failed to send review request' });
    }
  }
);

/**
 * GET /api/google-reviews/requests/:appointmentId
 * Get review requests for a specific appointment
 */
router.get(
  '/requests/:appointmentId',
  requireAnyPermissionExplain('appointment:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { appointmentId } = req.params;
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const requests = await GoogleReviewRequest.find({ 
        org_id,
        appointment: appointmentId 
      }).sort({ requestedAt: -1 }).lean();

      console.log('✅ [GET /google-reviews/requests] Retrieved requests for appointment:', appointmentId);
      return res.json(requests);
    } catch (error) {
      console.error('❌ [GET /google-reviews/requests] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve requests' });
    }
  }
);

/**
 * PATCH /api/google-reviews/mark-reviewed/:requestId
 * Manually mark a review request as reviewed
 */
router.patch(
  '/mark-reviewed/:requestId',
  requireAnyPermissionExplain('appointment:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { rating, reviewText, googleReviewId } = req.body;
      const { org_id, sub: userId } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const reviewRequest = await GoogleReviewRequest.findOne({ 
        _id: requestId,
        org_id 
      });

      if (!reviewRequest) {
        console.warn('⚠️ Review request not found:', requestId);
        return res.status(404).json({ error: 'Review request not found' });
      }

      reviewRequest.status = 'reviewed';
      reviewRequest.reviewedAt = new Date();
      reviewRequest.manuallyConfirmed = true;
      reviewRequest.confirmedBy = userId;
      reviewRequest.confirmationNotes = req.body.notes || '';

      if (rating) reviewRequest.reviewRating = rating;
      if (reviewText) reviewRequest.reviewText = reviewText;
      if (googleReviewId) reviewRequest.googleReviewId = googleReviewId;

      await reviewRequest.save();

      console.log('✅ [PATCH /google-reviews/mark-reviewed] Marked as reviewed:', requestId);
      return res.json({ success: true, reviewRequest });
    } catch (error) {
      console.error('❌ [PATCH /google-reviews/mark-reviewed] Error:', error);
      return res.status(500).json({ error: 'Failed to mark as reviewed' });
    }
  }
);

/**
 * GET /api/google-reviews/analytics
 * Get analytics for review requests
 */
router.get(
  '/analytics',
  requireAnyPermissionExplain('settings:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { startDate, endDate } = req.query;

      const matchFilter = { org_id };
      if (startDate || endDate) {
        matchFilter.requestedAt = {};
        if (startDate) matchFilter.requestedAt.$gte = new Date(startDate);
        if (endDate) matchFilter.requestedAt.$lte = new Date(endDate);
      }

      // Aggregate statistics
      const stats = await GoogleReviewRequest.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'clicked', 'reviewed']] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'clicked', 'reviewed']] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $in: ['$status', ['clicked', 'reviewed']] }, 1, 0] } },
            reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            avgRating: { $avg: '$reviewRating' }
          }
        }
      ]);

      const result = stats.length > 0 ? stats[0] : {
        total: 0,
        sent: 0,
        delivered: 0,
        clicked: 0,
        reviewed: 0,
        failed: 0,
        avgRating: 0
      };

      // Calculate conversion rates
      result.sentRate = result.total > 0 ? (result.sent / result.total * 100).toFixed(2) : 0;
      result.deliveredRate = result.sent > 0 ? (result.delivered / result.sent * 100).toFixed(2) : 0;
      result.clickRate = result.delivered > 0 ? (result.clicked / result.delivered * 100).toFixed(2) : 0;
      result.reviewRate = result.clicked > 0 ? (result.reviewed / result.clicked * 100).toFixed(2) : 0;
      result.overallConversionRate = result.total > 0 ? (result.reviewed / result.total * 100).toFixed(2) : 0;

      console.log('✅ [GET /google-reviews/analytics] Retrieved analytics for org:', org_id);
      return res.json(result);
    } catch (error) {
      console.error('❌ [GET /google-reviews/analytics] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve analytics' });
    }
  }
);

/**
 * GET /api/google-reviews/history
 * Get history of sent review requests
 */
router.get(
  '/history',
  requireAnyPermissionExplain('appointment:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { limit = 50, skip = 0, status } = req.query;

      const filter = { org_id };
      if (status) filter.status = status;

      const history = await GoogleReviewRequest.find(filter)
        .sort({ requestedAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('appointment', 'nameInput lastNameInput phoneInput phoneE164 dateTimeInput')
        .lean();

      const total = await GoogleReviewRequest.countDocuments(filter);

      console.log('✅ [GET /google-reviews/history] Retrieved history for org:', org_id);
      return res.json({ history, total, limit: parseInt(limit), skip: parseInt(skip) });
    } catch (error) {
      console.error('❌ [GET /google-reviews/history] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve history' });
    }
  }
);

/**
 * GET /api/google-reviews/all-requests
 * Get all review requests for dashboard modal with complete patient data
 */
router.get(
  '/all-requests',
  requireAnyPermissionExplain('appointment:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const requests = await GoogleReviewRequest.find({ org_id })
        .sort({ requestedAt: -1 })
        .populate('appointment', 'nameInput lastNameInput phoneInput phoneE164 emailInput')
        .lean();

      console.log('✅ [GET /google-reviews/all-requests] Retrieved', requests.length, 'requests for org:', org_id);
      return res.json(requests);
    } catch (error) {
      console.error('❌ [GET /google-reviews/all-requests] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve review requests' });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REVIEW MANAGEMENT ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const gmbService = require('../services/GoogleMyBusinessService');
const GoogleReview = require('../models/GoogleReview');

/**
 * GET /api/google-reviews/locations
 * List all Google My Business locations for the organization
 * Uses persistent MongoDB cache (30 minutes TTL) to avoid quota issues
 */
router.get(
  '/locations',
  requireAnyPermissionExplain('settings:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      console.log('📍 [Locations] Request from org:', org_id);
      
      // Check persistent cache first (30 minutes TTL)
      const cachedData = await getCachedData(org_id, 'locations');
      if (cachedData) {
        return res.json(cachedData);
      }
      
      if (!org_id) {
        console.error('❌ [Locations] No org_id found');
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      // Check if settings exist
      const settings = await GoogleReviewSettings.findOne({ org_id })
        .select('+googleAccessToken +googleRefreshToken +googleTokenExpiry');
      
      console.log('📍 [Locations] Settings check:', {
        found: !!settings,
        hasAccessToken: !!settings?.googleAccessToken,
        hasRefreshToken: !!settings?.googleRefreshToken,
        tokenExpiry: settings?.googleTokenExpiry,
        isExpired: settings?.googleTokenExpiry ? new Date(settings.googleTokenExpiry) < new Date() : null,
      });

      if (!settings || !settings.googleAccessToken) {
        console.warn('⚠️ [Locations] No valid credentials found');
        return res.json({
          accounts: [],
          locations: [],
          connected: false,
          message: 'Google My Business account not connected'
        });
      }

      console.log('📍 [Locations] Calling listLocations service...');
      const result = await gmbService.listLocations(org_id);
      
      console.log('✅ [Locations] Success! Accounts:', result?.accounts?.length || 0, 'Locations:', result?.locations?.length || 0);
      
      // Cache the successful result for 30 minutes
      const responseData = {
        ...result,
        connected: true,
        cached: false,
      };
      
      await setCachedData(org_id, 'locations', responseData, 30);
      
      return res.json(responseData);
    } catch (error) {
      console.error('❌ [Locations] Error:', error.message);
      
      // Check if it's a quota error
      const isQuotaError = error.message?.includes('Quota exceeded') || 
                          error.message?.includes('quota') ||
                          error.code === 429;
      
      if (isQuotaError) {
        console.error('⚠️ [Locations] QUOTA EXCEEDED - Checking for stale cache...');
        
        // Try to return stale cache (even if expired)
        const staleData = await getStaleCachedData(org_id, 'locations');
        
        if (staleData) {
          console.log('✅ [Locations] Returning stale cached data due to quota limit');
          return res.json({
            ...staleData,
            quotaExceeded: true,
            warning: 'Using cached data due to Google API quota limit',
          });
        }
        
        // No cache available, return error with helpful message
        return res.status(429).json({
          accounts: [],
          locations: [],
          connected: false,
          quotaExceeded: true,
          error: 'Google API quota exceeded',
          message: 'Too many requests to Google My Business API. Please wait a few minutes and try again.',
          retryAfter: 60,
        });
      }
      
      // Other errors - return empty arrays to allow UI to show "not connected" state
      console.error('❌ [Locations] Error stack:', error.stack);
      return res.json({
        accounts: [],
        locations: [],
        connected: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }
);

/**
 * POST /api/google-reviews/sync
 * Manually sync reviews from Google My Business
 * Rate limited: Max 1 sync every 10 minutes per location to avoid quota issues
 */
router.post(
  '/sync',
  requireAnyPermissionExplain('settings:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { locationName } = req.body;

      if (!locationName) {
        return res.status(400).json({ error: 'locationName is required' });
      }

      console.log('🔄 [Sync] Starting sync for location:', locationName);

      // Check if we synced recently (10 minutes cooldown to avoid quota issues)
      const syncLockKey = `sync_lock_${locationName}`;
      const recentSync = await getCachedData(org_id, syncLockKey);
      
      if (recentSync) {
        const remainingSeconds = Math.max(0, 600 - recentSync.cacheAge);
        console.log('⚠️ [Sync] Recent sync found, cooldown active:', remainingSeconds, 'seconds remaining');
        return res.status(429).json({
          error: 'sync_cooldown',
          message: `Reviews were synced recently. Please wait ${Math.ceil(remainingSeconds / 60)} minutes before syncing again.`,
          lastSync: recentSync.cacheAge,
          cooldown: true,
          retryAfter: remainingSeconds,
        });
      }

      // Set sync lock (10 minutes) BEFORE making API call
      await setCachedData(org_id, syncLockKey, { syncing: true, startedAt: new Date() }, 10);

      try {
        const result = await gmbService.syncReviews(org_id, locationName);
        
        console.log('✅ [Sync] Successfully completed for org:', org_id, '- Synced:', result.synced || 0, 'reviews');
        return res.json(result);
      } catch (syncError) {
        console.error('❌ [Sync] API Error:', syncError.message);
        
        // Remove sync lock on error so user can retry sooner
        await GoogleReviewsCache.deleteOne({ org_id, cacheKey: syncLockKey });
        console.log('🔓 [Sync] Lock removed due to error');
        
        // Check if it's a quota error
        if (syncError.message?.includes('quota') || syncError.message?.includes('Quota exceeded') || syncError.code === 429) {
          return res.status(429).json({
            error: 'quota_exceeded',
            message: 'Google API quota exceeded. Please try again in 10-15 minutes.',
            retryAfter: 600,
          });
        }
        
        throw syncError;
      }
    } catch (error) {
      console.error('❌ [POST /google-reviews/sync] Error:', error);
      return res.status(500).json({ 
        error: 'Failed to sync reviews',
        message: error.message 
      });
    }
  }
);

/**
 * GET /api/google-reviews/reviews
 * Get all synced reviews with filtering and pagination
 */
router.get(
  '/reviews',
  requireAnyPermissionExplain('appointment:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { 
        page = 0, 
        limit = 20, 
        rating, 
        hasComment,
        hasReply,
        flagged,
        archived,
        startDate,
        endDate,
        search
      } = req.query;

      const query = { org_id };

      // Filters
      if (rating) query.starRating = rating;
      if (hasComment === 'true') query.comment = { $ne: '' };
      if (hasReply === 'true') query['reviewReply.comment'] = { $exists: true, $ne: null };
      if (flagged === 'true') query.flagged = true;
      if (archived !== undefined) query.archived = archived === 'true';
      
      if (startDate || endDate) {
        query.createTime = {};
        if (startDate) query.createTime.$gte = new Date(startDate);
        if (endDate) query.createTime.$lte = new Date(endDate);
      }

      if (search) {
        query.$or = [
          { comment: { $regex: search, $options: 'i' } },
          { 'reviewer.displayName': { $regex: search, $options: 'i' } }
        ];
      }

      const [reviews, total] = await Promise.all([
        GoogleReview.find(query)
          .sort({ createTime: -1 })
          .limit(parseInt(limit))
          .skip(parseInt(page) * parseInt(limit))
          .populate('relatedAppointment', 'nameInput lastNameInput phoneInput')
          .lean(),
        GoogleReview.countDocuments(query)
      ]);

      console.log('✅ [GET /google-reviews/reviews] Retrieved reviews for org:', org_id);
      return res.json({ 
        reviews, 
        total, 
        page: parseInt(page), 
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      console.error('❌ [GET /google-reviews/reviews] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve reviews' });
    }
  }
);

/**
 * GET /api/google-reviews/stats
 * Get review statistics and analytics
 */
router.get(
  '/stats',
  requireAnyPermissionExplain('appointment:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { startDate, endDate } = req.query;

      const stats = await gmbService.getReviewStats(org_id, startDate, endDate);
      
      console.log('✅ [GET /google-reviews/stats] Retrieved stats for org:', org_id);
      return res.json(stats);
    } catch (error) {
      console.error('❌ [GET /google-reviews/stats] Error:', error);
      return res.status(500).json({ error: 'Failed to retrieve statistics' });
    }
  }
);

/**
 * PATCH /api/google-reviews/reviews/:reviewId
 * Update review metadata (local only)
 */
router.patch(
  '/reviews/:reviewId',
  requireAnyPermissionExplain('appointment:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { reviewId } = req.params;
      const { tags, notes, flagged, archived } = req.body;

      const updateData = {};
      if (tags !== undefined) updateData.tags = tags;
      if (notes !== undefined) updateData.notes = notes;
      if (flagged !== undefined) updateData.flagged = flagged;
      if (archived !== undefined) updateData.archived = archived;

      const review = await GoogleReview.findOneAndUpdate(
        { reviewId, org_id },
        { $set: updateData },
        { new: true }
      );

      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      console.log('✅ [PATCH /google-reviews/reviews/:reviewId] Updated review:', reviewId);
      return res.json(review);
    } catch (error) {
      console.error('❌ [PATCH /google-reviews/reviews/:reviewId] Error:', error);
      return res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

/**
 * POST /api/google-reviews/reviews/:reviewId/reply
 * Reply to a review on Google
 */
router.post(
  '/reviews/:reviewId/reply',
  requireAnyPermissionExplain('appointment:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { reviewId } = req.params;
      const { comment, reviewName } = req.body;

      if (!comment || !reviewName) {
        return res.status(400).json({ error: 'comment and reviewName are required' });
      }

      await gmbService.replyToReview(org_id, reviewName, comment);
      
      // Fetch updated review
      const review = await GoogleReview.findOne({ reviewId, org_id });

      console.log('✅ [POST /google-reviews/reviews/:reviewId/reply] Reply posted for review:', reviewId);
      return res.json(review);
    } catch (error) {
      console.error('❌ [POST /google-reviews/reviews/:reviewId/reply] Error:', error);
      return res.status(500).json({ 
        error: 'Failed to post reply',
        message: error.message 
      });
    }
  }
);

/**
 * DELETE /api/google-reviews/reviews/:reviewId/reply
 * Delete a review reply from Google
 */
router.delete(
  '/reviews/:reviewId/reply',
  requireAnyPermissionExplain('appointment:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { reviewId } = req.params;
      const { reviewName } = req.body;

      if (!reviewName) {
        return res.status(400).json({ error: 'reviewName is required' });
      }

      await gmbService.deleteReviewReply(org_id, reviewName);
      
      // Fetch updated review
      const review = await GoogleReview.findOne({ reviewId, org_id });

      console.log('✅ [DELETE /google-reviews/reviews/:reviewId/reply] Reply deleted for review:', reviewId);
      return res.json(review);
    } catch (error) {
      console.error('❌ [DELETE /google-reviews/reviews/:reviewId/reply] Error:', error);
      return res.status(500).json({ 
        error: 'Failed to delete reply',
        message: error.message 
      });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REVIEW MANAGEMENT ENDPOINTS (NEW GMB INTEGRATION)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/google-reviews/sync
 * Manually sync reviews from Google My Business
 */
router.post(
  '/sync',
  requireAnyPermissionExplain('settings:write', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const { locationName, pageSize = 50 } = req.body;

      if (!locationName) {
        return res.status(400).json({ error: 'locationName is required' });
      }

      const result = await gmbService.syncReviews(org_id, locationName, pageSize);
      
      console.log('✅ [POST /google-reviews/sync] Synced reviews:', result);
      return res.json(result);
    } catch (error) {
      console.error('❌ [POST /google-reviews/sync] Error:', error);
      return res.status(500).json({ 
        error: 'Failed to sync reviews',
        message: error.message 
      });
    }
  }
);

/**
 * GET /api/google-reviews/reviews
 * List reviews with filters and pagination
 */
router.get(
  '/reviews',
  requireAnyPermissionExplain('settings:read', 'dev-admin'),
  async (req, res) => {
    try {
      const { org_id } = await helpers.getTokenInfo(req.headers.authorization || '');
      
      if (!org_id) {
        return res.status(403).json({ error: 'Organization ID not found' });
      }

      const {
        page = 0,
        limit = 20,
        rating,
        hasComment,
        hasReply,
        flagged,
        archived = false,
        startDate,
        endDate,
        search
      } = req.query;

      const filter = { org_id, archived: archived === 'true' };

      if (rating) filter.starRating = rating;
      if (hasComment === 'true') filter.comment = { $exists: true, $ne: '' };
      if (hasReply === 'true') filter['reviewReply.comment'] = { $exists: true, $ne: '' };
      if (flagged === 'true') filter.flagged = true;
      if (startDate || endDate) {
        filter.createTime = {};
        if (startDate) filter.createTime.$gte = new Date(startDate);
        if (endDate) filter.createTime.$lte = new Date(endDate);
      }
      if (search) {
        filter.$or = [
          { comment: { $regex: search, $options: 'i' } },
          { 'reviewer.displayName': { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = parseInt(page) * parseInt(limit);
      const reviews = await GoogleReview.find(filter)
        .sort({ createTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await GoogleReview.countDocuments(filter);

      return res.json({
        reviews,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      console.error('❌ [GET /google-reviews/reviews] Error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch reviews',
        message: error.message 
      });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE CLEANUP JOB (Runs daily)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Cleanup expired cache entries daily
// Note: MongoDB TTL index will also auto-delete expired entries, but this provides immediate cleanup
setInterval(async () => {
  try {
    const result = await GoogleReviewsCache.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    if (result.deletedCount > 0) {
      console.log('🧹 [Cache Cleanup] Removed', result.deletedCount, 'expired cache entries');
    }
  } catch (error) {
    console.error('❌ [Cache Cleanup] Error:', error);
  }
}, 24 * 60 * 60 * 1000); // Run every 24 hours

module.exports = router;
