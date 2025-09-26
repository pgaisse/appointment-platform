// apps/frontend/src/Hooks/Query/useProfile.ts
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const baseURL = import.meta.env.VITE_BASE_URL; // e.g. https://dev.letsmarter.com:8443/api

export type TokenUser = {
  id: string | null;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  org_id: string | null;
  orgs: string[];
  roles: string[];
  permissions: string[];
  org_name: string | null;
};

export type DbUser = {
  id?: string;
  auth0_id?: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string | null;
  org_id?: string | null;
  orgs?: string[];
  roles?: string[];
  permissions?: string[];
  org_name?:string
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
};

type ProfileResp = {
  ok: boolean;
  tokenUser: TokenUser;
  dbUser: DbUser | null;
  stats?: { rolesCount: number; permissionsCount: number; orgsCount: number };
};

async function authed<T>(token: string, method: "GET" | "POST" | "PUT", url: string, data?: any, params?: any) {
  const res = await axios.request<T>({
    baseURL,
    url,
    method,
    data,
    params,
    withCredentials: true,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export function useProfile() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  return useQuery({
    enabled: isAuthenticated,
    queryKey: ["profile-me"],
    queryFn: async (): Promise<ProfileResp> => {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });

      try {
        return await authed<ProfileResp>(token, "GET", "/profile/me");
      } catch (e: any) {
        // fallback to your legacy /secure/me if /profile/me is not mounted yet
        if (e?.response?.status === 404) {
          const legacy = await authed<any>(token, "GET", "/secure/me");
          return {
            ok: true,
            tokenUser: legacy.tokenUser,
            dbUser: legacy.dbUser,
            stats: {
              rolesCount: (legacy.tokenUser?.roles || []).length,
              permissionsCount: (legacy.tokenUser?.permissions || []).length,
              orgsCount: (legacy.tokenUser?.orgs || []).length,
            },
          };
        }
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfile() {
  const { getAccessTokenSilently } = useAuth0();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name?: string; picture?: string }) => {
      const token = await getAccessTokenSilently({
        cacheMode: "off",
        authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
      });
      return authed<{ ok: boolean }>(token, "PUT", "/profile", payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile-me"] });
    },
  });
}

export function useRefreshSession() {
  const { getAccessTokenSilently } = useAuth0();
  return async () => {
    await getAccessTokenSilently({
      cacheMode: "off",
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
  };
}
