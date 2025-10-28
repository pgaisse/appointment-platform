// apps/frontend/src/Hooks/Query/useAppointmentSearch.ts
import { useAuthFetch } from "@/lib/authFetch";
import { useQuery } from "@tanstack/react-query";
import { appointmentsSearchKey } from "@/lib/queryKeys";

function looksLikeObjectId(s: string) {
  return /^[a-f\d]{24}$/i.test(s);
}

function looksLikePhone(s: string) {
  // allow digits and basic phone punctuation, at least 6 chars
  return /^[\d\s()+-]{6,}$/.test(s);
}

export function useAppointmentSearch<T = any>(q: string, limit = 100, exact?: boolean) {
  const authFetch = useAuthFetch();
  const trimmed = q.trim();
  const len = trimmed.length;

  // Heuristics: exact for email/id/phone; otherwise suggestions (prefix) after 3+ chars
  const heuristicExact = trimmed.includes("@") || looksLikeObjectId(trimmed) || looksLikePhone(trimmed);
  const effectiveExact = typeof exact === "boolean" ? exact : heuristicExact;
  const suggest = !effectiveExact && len >= 3;
  const enabled = effectiveExact ? len >= 1 : len >= 3;

  return useQuery<{ items: T[]; total: number }>({
    queryKey: appointmentsSearchKey.query({ q, limit, exact: effectiveExact }),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", String(limit));
      params.set("exact", String(Boolean(effectiveExact)));
      if (suggest) params.set("suggest", "true");
      const res = await authFetch(`/api/appointment-manager/search?${params.toString()}`, { signal });
      return res.json();
    },
    enabled,
    staleTime: 15_000,
  });
}
