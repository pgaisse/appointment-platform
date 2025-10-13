// useSuggestProviders.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

export type SuggestParams = {
  from: string;
  to: string;
  treatmentIds: string[];
  durationMin?: number;
};

export type Provider = {
  _id: string;
  firstName: string;
  lastName: string;
  color?: string;
  skills?: string[];
  initials?: string;
};

export type SuggestItem = {
  provider: Provider;
  fits: boolean;
  partial: boolean;
  score?: number;
};

const BASE =
  (import.meta as any).env?.VITE_BASE_URL ?? "/api";

const AUDIENCE =
  (window as any).__ENV__?.AUTH0_AUDIENCE ||
  (import.meta as any).env?.VITE_AUTH0_AUDIENCE ||
  "";

async function authedFetch<T>(
  url: string,
  getAccessTokenSilently: any,
  signal?: AbortSignal
): Promise<T> {
  const token = await getAccessTokenSilently({ audience: AUDIENCE });
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  return (data?.data ?? data) as T;
}

export function useSuggestProviders(params?: SuggestParams) {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery<SuggestItem[]>({
    queryKey: ["providers", "suggest", params],
    enabled: !!params?.from && !!params?.to && !!params?.treatmentIds?.length,
    queryFn: ({ signal }) => {
      const q = new URLSearchParams();
      q.set("from", params!.from);
      q.set("to", params!.to);
      params!.treatmentIds.forEach((t) => q.append("treatmentIds", t));
      if (params?.durationMin) q.set("durationMin", String(params.durationMin));

      const url = `${BASE}/providers/suggest?${q.toString()}`;
      return authedFetch<SuggestItem[]>(url, getAccessTokenSilently, signal);
    },
    staleTime: 60_000,
  });
}
