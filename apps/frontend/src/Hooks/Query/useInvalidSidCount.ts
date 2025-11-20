// apps/frontend/src/Hooks/Query/useInvalidSidCount.ts
import { useQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

export interface InvalidSidCountResponse {
  invalidSidCount: number;
  skipped?: boolean;
  reason?: string;
}

export const useInvalidSidCount = (enabled: boolean) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useQuery<InvalidSidCountResponse>({
    queryKey: ['dashboard-invalid-sid-count'],
    enabled: isAuthenticated && enabled,
    queryFn: async () => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/dashboard/stats/invalid-chat-sids`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data as InvalidSidCountResponse;
    },
    staleTime: 2 * 60_000, // 2 minutos
    refetchOnWindowFocus: false,
  });
};
