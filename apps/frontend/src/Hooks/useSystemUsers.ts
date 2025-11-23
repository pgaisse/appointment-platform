import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth0Api } from "./useAdminAuth0Api";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

export type SystemUser = {
  id: string;
  auth0_id?: string | null;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  status?: "active" | "blocked" | string;
};

type DbUser = {
  _id: string;
  auth0_id: string;
  picture?: string;
  name?: string;
  email?: string;
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
 * Hook para listar/buscar usuarios del sistema usando AdminAuth0 API + DB users.
 * - Mantiene resultados previos con `placeholderData`.
 * - Merge Auth0 users with DB users to get avatars with signed URLs.
 */
export function useSystemUsers(q: string, enabled = true, orgId?: string) {
  const { searchUsers } = useAdminAuth0Api();
  const { getAccessTokenSilently } = useAuth0();

  // Fetch DB users for avatars with signed URLs
  const dbUsersQuery = useQuery<DbUser[]>({
    queryKey: ["db-users-system", q, orgId ?? "all"],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
        });
        const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { q, org_id: orgId || undefined, limit: 200 },
        });
        return response.data?.users || [];
      } catch (error) {
        console.error("Error fetching DB users:", error);
        return [];
      }
    },
    placeholderData: (prev) => prev ?? [],
  });

  const query = useQuery<SystemUser[]>({
    queryKey: ["system-users", q, orgId ?? "all"],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const resp = await searchUsers(q, 0, 20, orgId);
      const arr = pickArray(resp);
      return arr.map(normalizeUser);
    },
    placeholderData: (prev) => prev ?? [],
  });

  // Merge Auth0 users with DB users for avatars
  const mergedUsers = useMemo(() => {
    const auth0Users = query.data || [];
    const dbUsers = dbUsersQuery.data || [];
    
    // Create map of auth0_id to DB user
    const dbUserMap = new Map<string, DbUser>();
    dbUsers.forEach(dbUser => {
      if (dbUser.auth0_id) {
        dbUserMap.set(dbUser.auth0_id, dbUser);
      }
    });

    // Merge users, prioritizing DB picture (has signed URL)
    return auth0Users.map(a0User => {
      const dbUser = dbUserMap.get(a0User.id);
      return {
        ...a0User,
        picture: dbUser?.picture || a0User.picture,
        name: dbUser?.name || a0User.name,
      };
    });
  }, [query.data, dbUsersQuery.data]);

  const byId = useMemo(() => {
    const m = new Map<string, SystemUser>();
    mergedUsers.forEach((u) => m.set(u.id, u));
    return m;
  }, [mergedUsers]);

  return { users: { ...query, data: mergedUsers }, byId };
}
