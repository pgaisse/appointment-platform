import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";
import type { Weekly } from "@/Hooks/Query/useProviders";

const BASE = (import.meta as any).env?.VITE_BASE_URL ?? "/api";
const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ||
  (import.meta as any).env?.VITE_AUTH0_AUDIENCE ||
  "";

async function getAuthHeader(getToken: any) {
  const token = await getToken({ audience: AUDIENCE });
  return { Authorization: `Bearer ${token}` };
}

export type ProviderSchedule = {
  weekly: Weekly;
  timezone?: string;
  updatedAt?: string;
};

const EMPTY_WEEKLY: Weekly = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

export function useProviderSchedule(providerId?: string) {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<ProviderSchedule>({
    queryKey: ["provider-schedule", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeader(getAccessTokenSilently)),
      };
      const url = `${BASE}/providers/${providerId}/schedule`;
      const res = await fetch(url, { headers });
      if (res.status === 404) {
        return { weekly: EMPTY_WEEKLY, timezone: "Australia/Sydney" };
      }
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const payload = (json?.data ?? json) as Partial<ProviderSchedule>;
      return {
        weekly: (payload?.weekly as Weekly) ?? EMPTY_WEEKLY,
        timezone: payload?.timezone ?? "Australia/Sydney",
        updatedAt: payload?.updatedAt,
      };
    },
    placeholderData: { weekly: EMPTY_WEEKLY, timezone: "Australia/Sydney" },
  });
}
