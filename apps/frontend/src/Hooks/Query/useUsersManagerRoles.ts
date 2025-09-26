// apps/frontend/src/Hooks/Query/useUsersManagerRoles.ts
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";

export type A0Permission = { permission_name: string; resource_server_identifier?: string };
export type A0Role = { id: string; name: string; description?: string; permissions?: A0Permission[] };

const baseURL = import.meta.env.VITE_BASE_URL; // e.g. https://dev.letsmarter.com:8443/api

// Generic authenticated request helper
async function authed<T>(
  token: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  data?: any,
  params?: any
): Promise<T> {
  const res = await axios.request<T>({
    baseURL,
    url,
    method,
    data,
    params,
    headers: { Authorization: `Bearer ${token}` },
    withCredentials: true,
  });
  return res.data;
}

/** Auth0: get API token with correct audience (and optional org) */
function useApiToken() {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isAuthenticated) return void (alive && setToken(null));
      try {
        const t = await getAccessTokenSilently({
          cacheMode: "on",
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            // organization: import.meta.env.VITE_AUTH0_ORG_ID, // if you use Orgs
          },
        });
        if (alive) setToken(t);
      } catch (e: any) {
        const msg = String(e?.error || e?.message || e);
        const needsLogin = /login_required|consent_required|interaction_required/.test(msg);
        if (needsLogin) {
          try {
            await loginWithRedirect({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                // organization: import.meta.env.VITE_AUTH0_ORG_ID,
              },
            });
          } catch {}
        }
        if (alive) setToken(null);
      }
    })();
    return () => { alive = false; };
  }, [getAccessTokenSilently, isAuthenticated, loginWithRedirect]);

  return token;
}

/** Fetch all roles (optionally with permissions) */
export function useAllRoles(withPermissions = true) {
  const token = useApiToken();
  return useQuery({
    enabled: !!token,
    queryKey: ["a0-roles", withPermissions],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return authed<A0Role[]>(
        token!,
        "GET",
        "/admin-auth0/roles",
        undefined,
        { withPermissions: withPermissions ? 1 : 0 }
      );
    },
  });
}

/** Fetch roles currently assigned to a user */
export function useUserRoles(userId?: string) {
  const token = useApiToken();
  return useQuery({
    enabled: !!userId && !!token,
    queryKey: ["a0-user-roles", userId],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const data = await authed<{ roles: A0Role[] }>(
        token!,
        "GET",
        `/admin-auth0/users/${userId}/roles`
      );
      return data.roles || [];
    },
  });
}

/** Replace a user's roles (exact match) */
export function useReplaceUserRoles(userId?: string) {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (roleIds: string[]) => {
      if (!userId) throw new Error("Missing userId");
      // fresh token to avoid cache issues after changes
      const freshToken = await getAccessTokenSilently({
        cacheMode: "off",
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          // organization: import.meta.env.VITE_AUTH0_ORG_ID,
        },
      });
      await authed<{ ok: boolean }>(
        freshToken,
        "PUT",
        `/admin-auth0/users/${userId}/roles`,
        { roleIds, replace: true }
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["a0-user-roles", userId] });
      await qc.invalidateQueries({ queryKey: ["a0-roles"] });
    },
  });
}
