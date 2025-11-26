// apps/frontend/src/Hooks/Query/useMonthlyEventDays.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

const SYD_TZ = "Australia/Sydney";

function toSydneyMonth(d: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYD_TZ, year: "numeric", month: "2-digit"
  }).formatToParts(new Date(d));
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  return `${y}-${m}`; // YYYY-MM
}

async function fetchMonthDays(params: { month: string; tz?: string; token?: string }) {
  const url = new URL("/api/appointments-month-days", window.location.origin);
  url.searchParams.set("month", params.month);
  url.searchParams.set("tz", params.tz || SYD_TZ);

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ month: string; days: string[] }>;
}

export function useMonthlyEventDays(date: Date) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const month = useMemo(() => toSydneyMonth(date), [date]);

  return useQuery({
    queryKey: ['appointments-month-days', month],
    queryFn: async () => {
      const token = isAuthenticated ? await getAccessTokenSilently().catch(() => undefined) : undefined;
      return fetchMonthDays({ month, tz: SYD_TZ, token });
    },
    staleTime: 1000, // 1 segundo - marca como stale rápidamente
    gcTime: 5 * 60 * 1000, // 5 minutos en caché
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Siempre refetch al montar
  });
}
