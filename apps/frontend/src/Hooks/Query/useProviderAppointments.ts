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
function normalizeAppointments(raw: Appointment[] = [], providerId?: string): CalendarData[] {
  const out: CalendarData[] = [];

  for (const a of raw) {
    const patient = patientLabel(a);
    const title = patient || "Appointment";

    // 1) selectedAppDates (modelo principal con slots)
    if (Array.isArray(a.selectedAppDates) && a.selectedAppDates.length) {
      for (const slot of a.selectedAppDates) {
        const s = (slot as any)?.startDate ?? (slot as any)?.propStartDate;
        const e = (slot as any)?.endDate ?? (slot as any)?.propEndDate;
        if (!s || !e) continue;

        // Verificar si este slot tiene el provider (solo para appointments del nuevo esquema)
        const slotProviders = (slot as any)?.providers || [];
        const hasProviderInSlot = providerId && slotProviders.some(
          (p: any) => String(p?._id || p) === String(providerId)
        );

        // Si no está en el slot, verificar root (legacy)
        const rootProviders = (a as any)?.providers || [];
        const hasProviderInRoot = providerId && rootProviders.some(
          (p: any) => String(p?._id || p) === String(providerId)
        );

        // Solo agregar si el provider está en este slot o en root
        if (!providerId || hasProviderInSlot || hasProviderInRoot) {
          const slotTreatment = (slot as any)?.treatment;
          const slotPriority = (slot as any)?.priority;
          const rootTreatment = (a as any)?.treatment;
          const rootPriority = (a as any)?.priority;

          const descParts: string[] = [];
          const treatment = slotTreatment || rootTreatment;
          if (treatment?.name) descParts.push(`Treatment: ${treatment.name}`);
          if (a.note) descParts.push(a.note);

          out.push({
            _id: `${String(a._id)}-${(slot as any)?._id || out.length}`,
            title,
            start: new Date(s),
            end: new Date(e),
            desc: descParts.join(" · ") || "",
            color: slotPriority?.color || rootPriority?.color || (a as any)?.color || "purple.500",
          });
        }
      }
      continue;
    }

    // 2) fallback: selectedDates (una sola ventana)
    if ((a as any)?.selectedDates?.startDate && (a as any)?.selectedDates?.endDate) {
      const rootProviders = (a as any)?.providers || [];
      const hasProvider = !providerId || rootProviders.some(
        (p: any) => String(p?._id || p) === String(providerId)
      );

      if (hasProvider) {
        const treatment = (a as any)?.treatment;
        const priority = (a as any)?.priority;
        const descParts: string[] = [];
        if (treatment?.name) descParts.push(`Treatment: ${treatment.name}`);
        if (a.note) descParts.push(a.note);

        out.push({
          _id: String(a._id),
          title,
          start: new Date((a as any).selectedDates.startDate),
          end: new Date((a as any).selectedDates.endDate),
          desc: descParts.join(" · ") || "",
          color: priority?.color || (a as any)?.color || "purple.500",
        });
      }
    }
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
    refetchOnWindowFocus: false,
    staleTime: 60_000,
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
      const events = normalizeAppointments(resp?.data || [], providerId);
      console.log("[useProviderAppointments] normalized events:", events);
      return events;
    },
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
