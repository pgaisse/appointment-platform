// apps/frontend/src/Hooks/Query/useAppointmentsByRange.ts
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { View, Views } from "react-big-calendar";

// Si usas Auth0:
import { useAuth0 } from "@auth0/auth0-react";

// Ajusta si tienes un cliente axios centralizado
export type AppointmentsRangeParams = {
  start: string; // YYYY-MM-DD inclusive
  end: string;   // YYYY-MM-DD exclusive
  tz?: string;
  populate?: string[];
  limit?: number;
  token?: string;
};

async function fetchAppointmentsByRange(params: AppointmentsRangeParams) {
  const url = new URL("/api/appointments-range", window.location.origin);
  console.log(url)
  url.searchParams.set("start", params.start);
  url.searchParams.set("end", params.end);
  url.searchParams.set("tz", params.tz || "Australia/Sydney");
  if (params.populate?.length) url.searchParams.set("populate", params.populate.join(","));
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} - ${msg || res.statusText}`);
  }
  return res.json();
}

const SYD_TZ = "Australia/Sydney";

// YYYY-MM-DD en Sydney
function toSydneyYMD(d: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(d));
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toSydneyYMD(dt);
}

function weekdayShortInSydney(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: SYD_TZ, weekday: "short" }).format(date); // "Mon", ...
}

function startOfWeekSydney(date: Date) {
  // ISO week: Monday as start
  let d = new Date(date);
  for (let i = 0; i < 7; i++) {
    if (weekdayShortInSydney(d) === "Mon") break;
    d = new Date(d.getTime() - 24 * 3600 * 1000);
  }
  return d;
}

function startOfMonthSydney(date: Date) {
  const ymd = toSydneyYMD(date);
  const [y, m] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  return first;
}

export function computeRangeForView(date: Date, view: View) {
  if (view === Views.DAY) {
    const s = toSydneyYMD(date);
    const e = addDaysYMD(s, 1); // exclusivo
    return { start: s, end: e };
  }
  if (view === Views.WEEK) {
    const start = startOfWeekSydney(date);
    const s = toSydneyYMD(start);
    const e = addDaysYMD(s, 7); // exclusivo
    return { start: s, end: e };
  }
  // MONTH
  const start = startOfMonthSydney(date);
  const s = toSydneyYMD(start);
  // primer día del mes siguiente
  const [yy, mm] = s.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(yy, mm - 1 + 1, 1));
  const e = toSydneyYMD(nextMonth);
  return { start: s, end: e };
}

export type UseCalendarAppointmentsOptions = {
  date: Date;
  view: View;
  populate?: string[]; // ['priority','treatment']
  limit?: number;
};

// New hook focused on calendar ranges; easy to cancel via 'appointments-range' prefix
export function useCalendarAppointments(opts: UseCalendarAppointmentsOptions): UseQueryResult<any[], Error> {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const { start, end } = computeRangeForView(opts.date, opts.view);

  return useQuery({
    queryKey: ["appointments-range", start, end, opts.view],
    queryFn: async () => {
      const token = isAuthenticated ? await getAccessTokenSilently().catch(() => undefined) : undefined;
      return fetchAppointmentsByRange({
        start,
        end,
        tz: SYD_TZ,
        populate: opts.populate || ["priority", "treatment"],
        limit: opts.limit || 300,
        token,
      });
    },
    staleTime: 1000, // 1 segundo - marca como stale rápidamente para detectar cambios
    gcTime: 5 * 60 * 1000, // 5 minutos en caché - suficiente tiempo para cancelar/invalidar queries
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Siempre refetch al montar el componente
  });
}

// Backwards-compatible alias so existing imports keep working
export type UseAppointmentsByRangeOptions = UseCalendarAppointmentsOptions;

export function useAppointmentsByRange(opts: UseAppointmentsByRangeOptions): UseQueryResult<any[], Error> {
  return useCalendarAppointments(opts);
}
