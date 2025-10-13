import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import { Provider } from "@/types";

/* ====================================================================== */
/* Types                                                                  */
/* ====================================================================== */
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayBlock = {
  start: `${number}${number}:${number}${number}`; // HH:mm
  end: `${number}${number}:${number}${number}`;   // HH:mm
  location?: string;
  chair?: string;
};
export type Weekly = Partial<Record<DayKey, DayBlock[]>>;


export type SlotRange = { startUtc: string; endUtc: string };

type ProvidersListParams = {
  org?: string;
  skill?: string;
  location?: string;
  active?: boolean;
};

const BASE: string = (import.meta as any).env?.VITE_BASE_URL ?? "/api";
const AUDIENCE: string =
  (window as any).__ENV__?.AUTH0_AUDIENCE ||
  (import.meta as any).env?.VITE_AUTH0_AUDIENCE ||
  "";

/* ====================================================================== */
/* Helpers                                                                */
/* ====================================================================== */
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
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

export function formatSydneyLabel(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const base: Intl.DateTimeFormatOptions = {
    timeZone: "Australia/Sydney",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  const o = { ...(base as any), ...(opts || {}) };
  return new Intl.DateTimeFormat("en-AU", o).format(new Date(iso));
}

/* ====================================================================== */
/* Queries                                                                */
/* ====================================================================== */

export function useProvidersList(params?: ProvidersListParams) {
  const { getAccessTokenSilently } = useAuth0();
  const q = new URLSearchParams();
  if (params?.org) q.set("org", params.org);
  if (params?.skill) q.set("skill", params.skill);
  if (params?.location) q.set("location", params.location);
  if (typeof params?.active === "boolean") q.set("active", String(params.active));

  const key = ["providers", params?.org, params?.skill, params?.location, params?.active];

  return useQuery<Provider[]>({
    queryKey: key,
    queryFn: async () => {
      const url = `${BASE}/providers${q.toString() ? `?${q.toString()}` : ""}`;
      const data = await authedFetchJSON(getAccessTokenSilently, url);
      return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    },
    placeholderData: [],
  });
}

export function useCreateProvider() {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Provider>) => {
      const url = `${BASE}/providers`;
      return await authedFetchJSON(getAccessTokenSilently, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useUpdateProvider() {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Provider> }) => {
      const url = `${BASE}/providers/${id}`;
      return await authedFetchJSON(getAccessTokenSilently, url, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}

export function useUpsertProviderSchedule() {
  const { getAccessTokenSilently } = useAuth0();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { weekly: Weekly; breaks?: Weekly; timezone?: string; effectiveFrom?: string | null; effectiveTo?: string | null } }) => {
      const url = `${BASE}/providers/${id}/schedule`;
      return await authedFetchJSON(getAccessTokenSilently, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  });
}

export function useCreateProviderTimeOff() {
  const { getAccessTokenSilently } = useAuth0();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { kind: "PTO" | "Sick" | "Course" | "PublicHoliday" | "Block"; start: string; end: string; reason?: string; location?: string | null; chair?: string | null } }) => {
      const url = `${BASE}/providers/${id}/timeoff`;
      return await authedFetchJSON(getAccessTokenSilently, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  });
}

export function useProviderAvailability(
  providerId?: string,
  params?: { from: string; to: string; treatmentId?: string; location?: string; chair?: string }
) {
  const { getAccessTokenSilently } = useAuth0();
  const key = ["provider-availability", providerId, params?.from, params?.to, params?.treatmentId, params?.location, params?.chair];

  return useQuery<SlotRange[]>({
    queryKey: key,
    enabled: !!(providerId && params?.from && params?.to),
    queryFn: async () => {
      const q = new URLSearchParams({ from: params!.from, to: params!.to });
      if (params?.treatmentId) q.set("treatmentId", params.treatmentId);
      if (params?.location) q.set("location", params.location);
      if (params?.chair) q.set("chair", params.chair);
      const url = `${BASE}/providers/${providerId}/availability?${q.toString()}`;
      const data = await authedFetchJSON(getAccessTokenSilently, url);
      // Server may return {startUtc,endUtc,localLabel}. We only guarantee start/end.
      const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return arr.map((s) => ({
        startUtc: s.startUtc || s.start || s.startDate,
        endUtc: s.endUtc || s.end || s.endDate,
      })).filter((s) => s.startUtc && s.endUtc);
    },
    placeholderData: [],
  });
}
// === NEW: GET latest provider schedule
export function useProviderSchedule(providerId?: string) {
  const { getAccessTokenSilently } = useAuth0();
  return useQuery({
    queryKey: ['provider-schedule', providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const url = `${BASE}/providers/${providerId}/schedule`;
      const data = await authedFetchJSON(getAccessTokenSilently, url);
      // normaliza a { weekly, timezone } o null
      const d = (data?.data ?? null) as { weekly?: Weekly; timezone?: string } | null;
      return d;
    },
    staleTime: 60_000,
  });
}

// === NEW: PATCH time off
export function useUpdateProviderTimeOff() {
  const { getAccessTokenSilently } = useAuth0();
  return useMutation({
    mutationFn: async ({
      providerId,
      timeOffId,
      payload,
    }: {
      providerId: string;
      timeOffId: string;
      payload: Partial<{ kind: "PTO" | "Sick" | "Course" | "PublicHoliday" | "Block"; start: string; end: string; reason?: string; location?: string | null; chair?: string | null }>;
    }) => {
      const url = `${BASE}/providers/${providerId}/timeoff/${timeOffId}`;
      return await authedFetchJSON(getAccessTokenSilently, url, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
  });
}

// === NEW: DELETE time off
export function useDeleteProviderTimeOff() {
  const { getAccessTokenSilently } = useAuth0();
  return useMutation({
    mutationFn: async ({ providerId, timeOffId }: { providerId: string; timeOffId: string }) => {
      const url = `${BASE}/providers/${providerId}/timeoff/${timeOffId}`;
      return await authedFetchJSON(getAccessTokenSilently, url, { method: "DELETE" });
    },
  });
}