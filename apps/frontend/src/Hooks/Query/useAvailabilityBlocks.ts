// src/Hooks/Query/useAvailabilityBlocks.ts
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type ISO = string;
type OID = string;

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ??
  import.meta.env.VITE_API_BASE ??
  "/api";
const AUTH0_AUDIENCE =
  (import.meta as any)?.env?.VITE_AUTH0_AUDIENCE ??
  import.meta.env.VITE_AUTH0_AUDIENCE ??
  undefined;

async function authedFetch<T = any>(
  getAccessTokenSilently: (opts?: any) => Promise<string>,
  input: RequestInfo,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessTokenSilently(
    AUTH0_AUDIENCE
      ? { authorizationParams: { audience: AUTH0_AUDIENCE } }
      : undefined
  );

  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(input, { ...init, headers });
  if (!res.ok) {
    let text = "";
    try { text = await res.text(); } catch {}
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("application/json") ? res.json() : (res.text() as any)) as T;
}

/** ------------ Tipos --------------- */
export type AvailabilityBlock = {
  _id: OID;
  kind: "Block";
  start: ISO;
  end: ISO;
  reason?: string;
  location?: OID | null;
  chair?: OID | null;
};

export type ListBlocksResponse = { data: AvailabilityBlock[]; total: number };
export type CreateBlockResponse = { data: AvailabilityBlock };
export type DeleteBlockResponse = { ok: true; deletedId: OID };

/** ------------ Listar bloques (kind=Block) --------------- */
export function useAvailabilityBlocks(
  providerId: string | undefined,
  opts?: { from?: ISO; to?: ISO; enabled?: boolean }
) {
  const { getAccessTokenSilently } = useAuth0();

  return useQuery({
    queryKey: ["provider-availability-blocks", providerId, opts?.from, opts?.to],
    enabled: !!providerId && (opts?.enabled ?? true),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (opts?.from) qs.set("from", opts.from);
      if (opts?.to) qs.set("to", opts.to);

      const url = `${API_BASE}/providers/${providerId}/availability/blocks${
        qs.toString() ? `?${qs.toString()}` : ""
      }`;

      const res = await authedFetch<ListBlocksResponse>(getAccessTokenSilently, url);
      return res?.data ?? [];
    },
  });
}

/** ------------ Crear/bloquear un slot de availability --------------- */
export function useBlockAvailability(providerId: string) {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      start: ISO; // new Date(...).toISOString()
      end: ISO;   // new Date(...).toISOString()
      reason?: string;
      location?: OID | null;
      chair?: OID | null;
    }) => {
      const url = `${API_BASE}/providers/${providerId}/availability/blocks`;
      return authedFetch<CreateBlockResponse>(getAccessTokenSilently, url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-availability", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-availability-blocks", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-timeoff", providerId] }); // por si lo muestras también
    },
  });
}

/** ------------ Eliminar un bloqueo (reversible) --------------- */
export function useDeleteAvailabilityBlock(providerId: string) {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (blockId: OID) => {
      const url = `${API_BASE}/providers/${providerId}/availability/blocks/${blockId}`;
      return authedFetch<DeleteBlockResponse>(getAccessTokenSilently, url, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-availability", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-availability-blocks", providerId] });
      qc.invalidateQueries({ queryKey: ["provider-timeoff", providerId] });
    },
  });
}
