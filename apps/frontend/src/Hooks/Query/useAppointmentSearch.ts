// apps/frontend/src/Hooks/Query/useAppointmentSearch.ts
import { useAuthFetch } from "@/lib/authFetch";
import { useQuery } from "@tanstack/react-query";

export function useAppointmentSearch<T = any>(q: string, limit = 100) {
  const authFetch = useAuthFetch();
  const enabled = q.trim().length >= 2;

  return useQuery<{ items: T[]; total: number }>({
    queryKey: ["appointments-search"],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", String(limit));
      const res = await authFetch(`/api/appointment-manager/search?${params.toString()}`, { signal });
      return res.json();
    },
    enabled,
    staleTime: 15_000,
  });
}
