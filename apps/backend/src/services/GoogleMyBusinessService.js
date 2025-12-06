// apps/backend/src/services/GoogleMyBusinessService.js
const { google } = require('googleapis');
const GoogleReviewSettings = require('../models/GoogleReviewSettings');
const GoogleReview = require('../models/GoogleReview');

class GoogleMyBusinessService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get authenticated client for an organization
   */
  async getAuthClient(org_id) {
    console.log(`🔑 [GMB Service] Getting auth client for org: ${org_id}`);
    
    const settings = await GoogleReviewSettings.findOne({ org_id })
      .select('+googleAccessToken +googleRefreshToken +googleTokenExpiry');

    if (!settings) {
      console.error(`❌ [GMB Service] No settings found for org: ${org_id}`);
      throw new Error('Google My Business settings not found for this organization');
    }

    if (!settings.googleAccessToken) {
      console.error(`❌ [GMB Service] No access token found for org: ${org_id}`);
      throw new Error('Google My Business not connected for this organization');
    }

    console.log(`🔑 [GMB Service] Settings found:`, {
      hasAccessToken: !!settings.googleAccessToken,
      hasRefreshToken: !!settings.googleRefreshToken,
      tokenExpiry: settings.googleTokenExpiry,
      isExpired: settings.googleTokenExpiry ? Date.now() >= settings.googleTokenExpiry : false,
    });

    this.oauth2Client.setCredentials({
      access_token: settings.googleAccessToken,
      refresh_token: settings.googleRefreshToken,
      expiry_date: settings.googleTokenExpiry
    });

    // Refresh token if expired
    if (settings.googleTokenExpiry && Date.now() >= settings.googleTokenExpiry) {
      console.log(`🔄 [GMB Service] Token expired, refreshing for org: ${org_id}`);
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        console.log(`🔄 [GMB Service] Token refreshed successfully`);
        
        // Update stored tokens
        await GoogleReviewSettings.updateOne(
          { org_id },
          {
            googleAccessToken: credentials.access_token,
            googleTokenExpiry: credentials.expiry_date,
            updatedAt: new Date()
          }
        );

        this.oauth2Client.setCredentials(credentials);
        console.log(`✅ [GMB Service] Refreshed access token saved for org: ${org_id}`);
      } catch (error) {
        console.error(`❌ [GMB Service] Token refresh failed for org: ${org_id}`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new Error('Failed to refresh Google access token. Please reconnect.');
      }
    } else {
      console.log(`✅ [GMB Service] Token is still valid for org: ${org_id}`);
    }

    return this.oauth2Client;
  }

  /**
   * List all locations for an account
   */
  async listLocations(org_id) {
    try {
      console.log(`📍 [GMB Service] Starting listLocations for org: ${org_id}`);
      
      const authClient = await this.getAuthClient(org_id);
      console.log('📍 [GMB Service] Auth client obtained');
      
      const mybusiness = google.mybusinessaccountmanagement({ version: 'v1', auth: authClient });
      
      // List accounts
      console.log('📍 [GMB Service] Fetching accounts...');
      const accountsResponse = await mybusiness.accounts.list();
      const accounts = accountsResponse.data.accounts || [];
      
      console.log(`📍 [GMB Service] Found ${accounts.length} accounts:`, 
        accounts.map(acc => ({ name: acc.name, type: acc.type, accountName: acc.accountName }))
      );

      if (accounts.length === 0) {
        console.warn('⚠️ [GMB Service] No accounts found');
        return { accounts: [], locations: [] };
      }

      // Get locations for each account
      const allLocations = [];
      for (const account of accounts) {
        try {
          console.log(`📍 [GMB Service] Fetching locations for account: ${account.name}`);
          const locationsApi = google.mybusinessbusinessinformation({ version: 'v1', auth: authClient });
          const locationsResponse = await locationsApi.accounts.locations.list({
            parent: account.name,
            readMask: 'name,title,storefrontAddress,websiteUri,phoneNumbers,categories'
          });

          const locations = locationsResponse.data.locations || [];
          console.log(`📍 [GMB Service] Found ${locations.length} locations for account ${account.name}`);
          
          if (locations.length > 0) {
            console.log('📍 [GMB Service] Location details:', 
              locations.map(loc => ({ name: loc.name, title: loc.title }))
            );
          }
          
          allLocations.push(...locations);
        } catch (error) {
          console.error(`❌ [GMB Service] Failed to fetch locations for account ${account.name}:`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
          });
        }
      }

      console.log(`✅ [GMB Service] Total locations found: ${allLocations.length}`);
      return {
        accounts,
        locations: allLocations
      };
    } catch (error) {
      console.error('❌ [GMB Service] listLocations error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Sync reviews for a location
   */
  async syncReviews(org_id, locationName, pageSize = 50) {
    try {
      const authClient = await this.getAuthClient(org_id);
      const mybusiness = google.mybusiness({ version: 'v4', auth: authClient });

      console.log(`🔄 [GoogleMyBusiness] Syncing reviews for org: ${org_id}, location: ${locationName}`);

      let pageToken = null;
      let totalSynced = 0;
      let newReviews = 0;
      let updatedReviews = 0;

      do {
        const response = await mybusiness.accounts.locations.reviews.list({
          parent: locationName,
          pageSize,
          pageToken
        });

        const reviews = response.data.reviews || [];
        
        for (const review of reviews) {
          try {
            const reviewData = {
              org_id,
              reviewId: review.reviewId,
              reviewer: {
                profilePhotoUrl: review.reviewer?.profilePhotoUrl,
                displayName: review.reviewer?.displayName,
                isAnonymous: review.reviewer?.isAnonymous || false
              },
              starRating: review.starRating,
              comment: review.comment || '',
              createTime: new Date(review.createTime),
              updateTime: new Date(review.updateTime),
              reviewReply: review.reviewReply ? {
                comment: review.reviewReply.comment,
                updateTime: new Date(review.reviewReply.updateTime)
              } : null,
              syncedAt: new Date()
            };

            const existing = await GoogleReview.findOne({ reviewId: review.reviewId });

            if (existing) {
              // Update existing review
              await GoogleReview.updateOne(
                { reviewId: review.reviewId },
                { $set: reviewData }
              );
              updatedReviews++;
            } else {
              // Create new review
              await GoogleReview.create(reviewData);
              newReviews++;
            }

            totalSynced++;
          } catch (error) {
            console.error(`⚠️ [GoogleMyBusiness] Failed to sync review ${review.reviewId}:`, error.message);
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      // Update last sync time
      await GoogleReviewSettings.updateOne(
        { org_id },
        { lastSyncAt: new Date() }
      );

      console.log(`✅ [GoogleMyBusiness] Sync completed for org: ${org_id} - Total: ${totalSynced}, New: ${newReviews}, Updated: ${updatedReviews}`);

      return {
        success: true,
        totalSynced,
        newReviews,
        updatedReviews
      };
    } catch (error) {
      console.error('❌ [GoogleMyBusiness] syncReviews error:', error);
      throw error;
    }
  }

  /**
   * Reply to a review
   */
  async replyToReview(org_id, reviewName, comment) {
    try {
      const authClient = await this.getAuthClient(org_id);
      const mybusiness = google.mybusiness({ version: 'v4', auth: authClient });

      const response = await mybusiness.accounts.locations.reviews.updateReply({
        name: reviewName,
        requestBody: {
          comment
        }
      });

      // Update local record
      const reviewId = reviewName.split('/').pop();
      await GoogleReview.updateOne(
        { reviewId },
        {
          $set: {
            'reviewReply.comment': comment,
            'reviewReply.updateTime': new Date()
          }
        }
      );

      console.log(`✅ [GoogleMyBusiness] Reply posted for review: ${reviewId}`);

      return response.data;
    } catch (error) {
      console.error('❌ [GoogleMyBusiness] replyToReview error:', error);
      throw error;
    }
  }

  /**
   * Delete a review reply
   */
  async deleteReviewReply(org_id, reviewName) {
    try {
      const authClient = await this.getAuthClient(org_id);
      const mybusiness = google.mybusiness({ version: 'v4', auth: authClient });

      await mybusiness.accounts.locations.reviews.deleteReply({
        name: reviewName
      });

      // Update local record
      const reviewId = reviewName.split('/').pop();
      await GoogleReview.updateOne(
        { reviewId },
        { $unset: { reviewReply: '' } }
      );

      console.log(`✅ [GoogleMyBusiness] Reply deleted for review: ${reviewId}`);

      return { success: true };
    } catch (error) {
      console.error('❌ [GoogleMyBusiness] deleteReviewReply error:', error);
      throw error;
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStats(org_id, startDate = null, endDate = null) {
    try {
      const query = { org_id, archived: false };
      
      if (startDate || endDate) {
        query.createTime = {};
        if (startDate) query.createTime.$gte = new Date(startDate);
        if (endDate) query.createTime.$lte = new Date(endDate);
      }

      const reviews = await GoogleReview.find(query);

      const stats = {
        totalReviews: reviews.length,
        averageRating: 0,
        ratingDistribution: {
          FIVE: 0,
          FOUR: 0,
          THREE: 0,
          TWO: 0,
          ONE: 0
        },
        withComments: 0,
        withReplies: 0,
        flagged: 0,
        recentReviews: 0
      };

      let totalRating = 0;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      reviews.forEach(review => {
        // Rating distribution
        stats.ratingDistribution[review.starRating]++;
        
        // Numeric rating for average
        const numericRating = review.numericRating;
        totalRating += numericRating;

        // With comments
        if (review.comment && review.comment.trim()) {
          stats.withComments++;
        }

        // With replies
        if (review.hasReply()) {
          stats.withReplies++;
        }

        // Flagged
        if (review.flagged) {
          stats.flagged++;
        }

        // Recent
        if (review.createTime >= sevenDaysAgo) {
          stats.recentReviews++;
        }
      });

      if (reviews.length > 0) {
        stats.averageRating = (totalRating / reviews.length).toFixed(2);
      }

      // Response rate
      stats.responseRate = reviews.length > 0 
        ? ((stats.withReplies / reviews.length) * 100).toFixed(1) 
        : '0.0';

      return stats;
    } catch (error) {
      console.error('❌ [GoogleMyBusiness] getReviewStats error:', error);
      throw error;
    }
  }
}

module.exports = new GoogleMyBusinessService();
