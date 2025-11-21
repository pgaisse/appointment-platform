// apps/frontend/src/Hooks/Query/useInfiniteReportsResource.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import axios from 'axios';

export interface ReportsPageMeta {
  resource: string;
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  search: string | null;
}

export interface ReportsPage<T = any> {
  data: T[];
  meta: ReportsPageMeta;
}

export function useInfiniteReportsResource(resource: string, search: string) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  return useInfiniteQuery<ReportsPage>({
    queryKey: ['reports', resource, search],
    enabled: isAuthenticated && !!resource,
    initialPageParam: 1,
    getNextPageParam: (last) => last.meta.hasMore ? last.meta.page + 1 : undefined,
    queryFn: async ({ pageParam }) => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const url = `${import.meta.env.VITE_BASE_URL}/reports/${resource}?page=${pageParam}&limit=50&search=${encodeURIComponent(search||'')}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data as ReportsPage;
    },
    refetchOnWindowFocus: false,
  });
}
