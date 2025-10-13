import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import type { Appointment, Treatment } from "@/types";

/** Estructura que el CustomCalendar espera (clave: desc es string) */
export type CalendarData = {
  _id: string;
  title: string;
  start: Date;
  end: Date;
  desc: string;
  colorScheme?: string;
  color?: string;
};
export type TimeOffItem = {
  _id: string;
  kind: 'PTO' | 'Sick' | 'Course' | 'PublicHoliday' | 'Block';
  start: string; // ISO UTC
  end: string;   // ISO UTC
  reason?: string;
};



/** Vars de entorno/backend */
const BASE =
  (import.meta as any).env?.VITE_BASE_URL ??
  "/api";

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ||
  (import.meta as any).env?.VITE_AUTH0_AUDIENCE ||
  "";

/** fetch autenticado */
async function authedFetchJSON(getToken: any, input: RequestInfo, init?: RequestInit) {
  const token = await getToken({ audience: AUDIENCE });
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[useProviderAppointments] HTTP error:", res.status, txt);
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Util: nombre paciente a partir del Appointment (según tu modelo) */
function patientLabel(a: Appointment): string {
  // En tu modelo no hay patient embebido; componemos con nameInput + lastNameInput
  const full = [a?.nameInput, a?.lastNameInput].filter(Boolean).join(" ").trim();
  return full;
}

/** Normaliza { data: Appointment[] } a CalendarData[] */
function normalizeAppointments(raw: Appointment[] = []): CalendarData[] {
  const out: CalendarData[] = [];

  const pushEvent = (a: Appointment, s?: string | Date, e?: string | Date) => {
    if (!s || !e) return;
    const start = new Date(s);
    const end = new Date(e);

    // title: preferimos título explícito si existiera; si no, paciente; fallback "Appointment"
    const patient = patientLabel(a);
    const t = (a.treatment as unknown as Treatment | undefined);
    const title = patient || "Appointment";

    // desc SIEMPRE string (evita error de tipos en el calendario)
    const descParts: string[] = [];
    if (t && (t as any).name) descParts.push(`Treatment: ${(t as any).name}`);
    if (a.note) descParts.push(a.note);

    out.push({
      _id: String(a._id),
      title,
      start,
      end,
      desc: descParts.join(" · ") || "",
      color: a.priority.color,
    });
  };

  for (const a of raw) {
    // 1) selectedAppDates (tu modelo principal de citas agendadas)
    if (Array.isArray(a.selectedAppDates) && a.selectedAppDates.length) {
      for (const r of a.selectedAppDates) {
        // usa startDate/endDate; si no vienen, intenta propStartDate/propEndDate
        const s = (r as any)?.startDate ?? (r as any)?.propStartDate;
        const e = (r as any)?.endDate ?? (r as any)?.propEndDate;
        if (s && e) pushEvent(a, s, e);
      }
      continue;
    }

    // 2) fallback: selectedDates (una sola ventana)
    if ((a as any)?.selectedDates?.startDate && (a as any)?.selectedDates?.endDate) {
      pushEvent(a, (a as any).selectedDates.startDate, (a as any).selectedDates.endDate);
      continue;
    }

    // 3) si no hay nada interpretable, lo omitimos
  }

  return out;
}

/**
 * Hook para traer las citas de un provider.
 * Backend simple: GET /providers/:id/appointments -> { data, total }
 * Acepta opcionalmente un rango from/to (si el backend lo ignora, no pasa nada).
 */

export function useProviderTimeOff(
  providerId?: string,
  range?: { from?: string; to?: string }
) {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<TimeOffItem[]>({
    queryKey: ['provider-timeoff', providerId, range?.from, range?.to],
    enabled: !!providerId,
    queryFn: async () => {
      const q = new URLSearchParams();
      if (range?.from) q.set('from', range.from);
      if (range?.to) q.set('to', range.to);

      const url =
        q.toString()
          ? `${BASE}/providers/${providerId}/timeoff?${q.toString()}`
          : `${BASE}/providers/${providerId}/timeoff`;

      const resp = await authedFetchJSON(getAccessTokenSilently, url);
      return (resp?.data as TimeOffItem[]) || [];
    },
    placeholderData: [],
  });
}
export function useProviderAppointments(
  providerId?: string,
  range?: { from?: string; to?: string } // opcional
) {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<CalendarData[]>({
    queryKey: ["provider-appointments", providerId, range?.from, range?.to],
    enabled: !!providerId,
    queryFn: async () => {
      const q = new URLSearchParams();
      if (range?.from) q.set("from", range.from);
      if (range?.to) q.set("to", range.to);

      const url =
        q.toString().length > 0
          ? `${BASE}/providers/${providerId}/appointments?${q.toString()}`
          : `${BASE}/providers/${providerId}/appointments`;

      console.log("[useProviderAppointments] FETCH:", url);
      const resp = (await authedFetchJSON(getAccessTokenSilently, url)) as {
        data: Appointment[];
        total?: number;
      };

      console.log("[useProviderAppointments] raw data:", resp?.data);
      const events = normalizeAppointments(resp?.data || []);
      console.log("[useProviderAppointments] normalized events:", events);
      return events;
    },
    placeholderData: [],
  });
}
