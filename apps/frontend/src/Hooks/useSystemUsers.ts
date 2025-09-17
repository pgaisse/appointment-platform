import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth0Api } from "./useAdminAuth0Api";

export type SystemUser = {
  id: string;
  auth0_id?: string | null;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  status?: "active" | "blocked" | string;
};

function normalizeUser(u: any): SystemUser {
  return {
    id: u?.id ?? u?._id ?? u?.user_id ?? u?.auth0_id ?? u?.sub ?? "",
    auth0_id: u?.auth0_id ?? u?.user_id ?? null,
    email: u?.email ?? null,
    name: u?.name ?? u?.nickname ?? u?.email ?? null,
    picture: u?.picture ?? u?.picture_url ?? null,
    status: (u?.status ?? (u?.blocked ? "blocked" : "active")) as any,
  };
}

function pickArray(payload: any): any[] {
  if (!payload) return [];
  const p = payload.data ?? payload;
  if (Array.isArray(p)) return p;
  if (Array.isArray(p.users)) return p.users;
  if (Array.isArray(p.results)) return p.results;
  if (Array.isArray(p.items)) return p.items;
  if (Array.isArray(p.data)) return p.data;
  return [];
}

/**
 * Hook para listar/buscar usuarios del sistema usando AdminAuth0 API.
 * - Mantiene resultados previos con `placeholderData`.
 */
export function useSystemUsers(q: string, enabled = true, orgId?: string) {
  const { searchUsers } = useAdminAuth0Api();

  const query = useQuery<SystemUser[]>({
    queryKey: ["system-users", q, orgId ?? "all"],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // 👇 aquí nos adaptamos a la firma (q, page, perPage, orgId)
      const resp = await searchUsers(q, 0, 20, orgId);
      const arr = pickArray(resp);
      return arr.map(normalizeUser);
    },
    // v5 replacement for keepPreviousData
    placeholderData: (prev) => prev ?? [],
  });

  const byId = useMemo(() => {
    const m = new Map<string, SystemUser>();
    (query.data || []).forEach((u) => m.set(u.id, u));
    return m;
  }, [query.data]);

  return { users: query, byId };
}
