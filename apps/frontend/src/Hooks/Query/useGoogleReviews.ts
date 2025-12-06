// apps/frontend/src/Hooks/Query/useGoogleReviews.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';
import { useToast } from '@chakra-ui/react';
import type { GoogleReviewSettings, GoogleReviewHistory } from '@/types/googleReviews';

const BASE_URL = import.meta.env.VITE_BASE_URL || '/api';

// ──────────────────────────────────────────────────────────────────
// GET Settings
// ──────────────────────────────────────────────────────────────────

export const useGoogleReviewSettings = () => {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<GoogleReviewSettings>({
    queryKey: ['google-review-settings'],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// ──────────────────────────────────────────────────────────────────
// UPDATE Settings
// ──────────────────────────────────────────────────────────────────

export const useUpdateGoogleReviewSettings = () => {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<GoogleReviewSettings>) => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.patch(
        `${BASE_URL}/google-reviews/settings`,
        settings,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-review-settings'] });
      toast({
        title: 'Settings saved',
        description: 'Google Review settings have been updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving settings',
        description: error?.response?.data?.error || 'Failed to update settings.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });
};

// ──────────────────────────────────────────────────────────────────
// SEND Review Request
// ──────────────────────────────────────────────────────────────────

export const useSendGoogleReview = () => {
  const { getAccessTokenSilently } = useAuth0();
  const toast = useToast();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.post(
        `${BASE_URL}/google-reviews/send`,
        { appointmentId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Review request sent',
        description: 'The Google Review request has been sent via SMS.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to send review request.';
      toast({
        title: 'Error sending request',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
  });
};

// ──────────────────────────────────────────────────────────────────
// GET History
// ──────────────────────────────────────────────────────────────────

interface UseGoogleReviewHistoryParams {
  limit?: number;
  skip?: number;
  status?: string;
}

export const useGoogleReviewHistory = (params: UseGoogleReviewHistoryParams = {}) => {
  const { limit = 50, skip = 0, status } = params;
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<GoogleReviewHistory>({
    queryKey: ['google-review-history', limit, skip, status],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const queryParams: any = { limit, skip };
      if (status && status !== 'all') {
        queryParams.status = status;
      }

      const response = await axios.get(`${BASE_URL}/google-reviews/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: queryParams,
      });

      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// ──────────────────────────────────────────────────────────────────
// GET All Review Requests (for dashboard modal)
// ──────────────────────────────────────────────────────────────────

export const useAllGoogleReviewRequests = () => {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery({
    queryKey: ['all-google-review-requests'],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/all-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// ──────────────────────────────────────────────────────────────────
// GET Analytics
// ──────────────────────────────────────────────────────────────────

export const useGoogleReviewAnalytics = () => {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery({
    queryKey: ['google-review-analytics'],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/analytics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// ──────────────────────────────────────────────────────────────────
// GET Requests for a specific appointment
// ──────────────────────────────────────────────────────────────────

export const useGoogleReviewRequests = (appointmentId: string) => {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery({
    queryKey: ['google-review-requests', appointmentId],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/requests/${appointmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    },
    enabled: !!appointmentId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEW: REVIEW MANAGEMENT HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface GoogleReview {
  _id: string;
  org_id: string;
  reviewId: string;
  reviewer: {
    profilePhotoUrl?: string;
    displayName?: string;
    isAnonymous: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  numericRating: number;
  comment: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
  syncedAt: string;
  tags?: string[];
  notes?: string;
  flagged: boolean;
  archived: boolean;
  relatedAppointment?: {
    _id: string;
    nameInput: string;
    lastNameInput: string;
    phoneInput: string;
  };
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
    FIVE: number;
    FOUR: number;
    THREE: number;
    TWO: number;
    ONE: number;
  };
  withComments: number;
  withReplies: number;
  repliedReviews: number;
  responseRate: number;
  flagged: number;
  recentReviews: number;
}

export interface GoogleLocation {
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  websiteUri?: string;
  phoneNumbers?: {
    primaryPhone?: string;
  };
}

export interface ReviewsResponse {
  reviews: GoogleReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  rating?: string;
  hasComment?: boolean;
  hasReply?: boolean;
  flagged?: boolean;
  archived?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Fetch Google My Business locations
 */
export const useGoogleLocations = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<{ 
    accounts: any[]; 
    locations: GoogleLocation[];
    connected?: boolean;
    cached?: boolean;
    cacheAge?: number;
    quotaExceeded?: boolean;
    stale?: boolean;
  }>({
    queryKey: ['google-reviews', 'locations'],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Fetch reviews with filters and pagination
 */
export const useGoogleReviewsList = (filters: ReviewFilters = {}) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<ReviewsResponse>({
    queryKey: ['google-reviews', 'reviews', filters],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });

      const response = await axios.get(`${BASE_URL}/google-reviews/reviews?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Fetch review statistics
 */
export const useGoogleReviewStats = (startDate?: string, endDate?: string) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<ReviewStats>({
    queryKey: ['google-reviews', 'stats', startDate, endDate],
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await axios.get(`${BASE_URL}/google-reviews/stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Sync reviews from Google My Business
 */
export const useSyncGoogleReviews = () => {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (locationName: string) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const response = await axios.post(
        `${BASE_URL}/google-reviews/sync`,
        { locationName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'stats'] });
      toast({
        title: 'Reviews synced successfully',
        description: `${data.newReviews} new reviews, ${data.updatedReviews} updated`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to sync reviews',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },
  });
};

/**
 * Update review metadata (local only)
 */
export const useUpdateReviewMetadata = () => {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ 
      reviewId, 
      updates 
    }: { 
      reviewId: string; 
      updates: { tags?: string[]; notes?: string; flagged?: boolean; archived?: boolean } 
    }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const response = await axios.patch(
        `${BASE_URL}/google-reviews/reviews/${reviewId}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'stats'] });
      toast({
        title: 'Review updated',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update review',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });
};

/**
 * Reply to a review on Google
 */
export const useReplyToReview = () => {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ 
      reviewId, 
      reviewName,
      comment 
    }: { 
      reviewId: string;
      reviewName: string;
      comment: string;
    }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const response = await axios.post(
        `${BASE_URL}/google-reviews/reviews/${reviewId}/reply`,
        { reviewName, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'stats'] });
      toast({
        title: 'Reply posted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to post reply',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });
};

/**
 * Delete a review reply from Google
 */
export const useDeleteReviewReply = () => {
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ 
      reviewId, 
      reviewName 
    }: { 
      reviewId: string;
      reviewName: string;
    }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      const response = await axios.delete(
        `${BASE_URL}/google-reviews/reviews/${reviewId}/reply`,
        { 
          data: { reviewName },
          headers: { Authorization: `Bearer ${token}` } 
        }
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['google-reviews', 'stats'] });
      toast({
        title: 'Reply deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete reply',
        description: error?.response?.data?.message || error.message,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    },
  });
};
