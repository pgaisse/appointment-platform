import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { View, Views } from 'react-big-calendar';
import { useAuth0 } from '@auth0/auth0-react';

const SYD_TZ = 'Australia/Sydney';

// Tipos
export type UseCalendarAppointmentsOptions = {
  date: Date;
  view: View;
  populate?: string[];
  limit?: number;
};

type AppointmentsRangeParams = {
  start: string;
  end: string;
  tz?: string;
  populate?: string[];
  limit?: number;
  token?: string;
};

// Utilidades de fecha
function toSydneyYMD(d: Date | string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYD_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(d));
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${day}`;
}

function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toSydneyYMD(dt);
}

function weekdayShortInSydney(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: SYD_TZ, weekday: 'short' }).format(date);
}

function startOfWeekSydney(date: Date) {
  let d = new Date(date);
  for (let i = 0; i < 7; i++) {
    if (weekdayShortInSydney(d) === 'Mon') break;
    d = new Date(d.getTime() - 24 * 3600 * 1000);
  }
  return d;
}

function startOfMonthSydney(date: Date) {
  const ymd = toSydneyYMD(date);
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function computeRangeForView(date: Date, view: View) {
  if (view === Views.DAY) {
    const s = toSydneyYMD(date);
    const e = addDaysYMD(s, 1);
    return { start: s, end: e };
  }
  if (view === Views.WEEK) {
    const start = startOfWeekSydney(date);
    const s = toSydneyYMD(start);
    const e = addDaysYMD(s, 7);
    return { start: s, end: e };
  }
  // MONTH
  const start = startOfMonthSydney(date);
  const s = toSydneyYMD(start);
  const [yy, mm] = s.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(yy, mm - 1 + 1, 1));
  const e = toSydneyYMD(nextMonth);
  return { start: s, end: e };
}

// Fetch function
async function fetchAppointmentsByRange(params: AppointmentsRangeParams) {
  const url = new URL('/api/appointments-range', window.location.origin);
  url.searchParams.set('start', params.start);
  url.searchParams.set('end', params.end);
  url.searchParams.set('tz', params.tz || SYD_TZ);
  if (params.populate?.length) url.searchParams.set('populate', params.populate.join(','));
  if (params.limit) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {}),
    },
    credentials: 'include',
  });
  
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} - ${msg || res.statusText}`);
  }
  
  return res.json();
}

// Hook principal único
export function useCalendarAppointments(opts: UseCalendarAppointmentsOptions): UseQueryResult<any[], Error> {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const { start, end } = computeRangeForView(opts.date, opts.view);

  return useQuery({
    queryKey: ['calendar-appointments', start, end, opts.view],
    queryFn: async () => {
      const token = isAuthenticated ? await getAccessTokenSilently().catch(() => undefined) : undefined;
      return fetchAppointmentsByRange({
        start,
        end,
        tz: SYD_TZ,
        populate: opts.populate || ['selectedAppDates.priority', 'selectedAppDates.treatment'],
        limit: opts.limit || 300,
        token,
      });
    },
    staleTime: 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}
