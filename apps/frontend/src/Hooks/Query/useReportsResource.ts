import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@tanstack/react-query';

export interface ReportsPage<T=any> {
  data: T[];
  meta: {
    resource: string;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    search: string | null;
  };
}

export function useReportsResource(resource: string, search: string, page: number, limit: number, sortField: string, sortDir: 'asc' | 'desc') {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  return useQuery<ReportsPage>({
    queryKey: ['reports', resource, search, page, limit, sortField, sortDir],
    enabled: isAuthenticated && !!resource && page > 0,
    keepPreviousData: true,
    queryFn: async (): Promise<ReportsPage> => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      const base = import.meta.env.VITE_BASE_URL;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: search || '',
        sort: sortField || '',
        dir: sortDir,
      });
      const res = await fetch(`${base}/reports/${resource}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`reports_fetch_failed:${res.status}:${text}`);
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}
