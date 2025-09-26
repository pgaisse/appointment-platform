// src/api/adminAuth0.ts
import { useAuthFetch } from "@/api/authFetch";

export function useAdminAuth0Api() {
  const { authFetch } = useAuthFetch();

  return {
    // --- USERS ---
    searchUsers: (q = "", page = 0, perPage = 20, orgId?: string) =>
      authFetch(
        `/api/admin/auth0/users?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}${
          orgId ? `&org_id=${encodeURIComponent(orgId)}` : ""
        }`
      ),

    // --- ROLES ---
    listRoles: (opts?: { all?: boolean; page?: number; per_page?: number }) => {
      const all = opts?.all ? "&all=1" : "";
      const page = Number.isFinite(opts?.page) ? `&page=${opts?.page}` : "";
      const per = Number.isFinite(opts?.per_page) ? `&per_page=${opts?.per_page}` : "";
      return authFetch(`/api/admin/auth0/roles?include_totals=true${all}${page}${per}`);
    },

    getUserRoles: (userId: string, orgId?: string) =>
      authFetch(
        `/api/admin/auth0/users/${encodeURIComponent(userId)}/roles${
          orgId ? `?org_id=${encodeURIComponent(orgId)}` : ""
        }`
      ),

    /** Permisos de un rol (Auth0 Management). Usa ?all=1 por defecto */
    getRolePermissions: (roleId: string, all = true) =>
      authFetch(
        `/api/admin/auth0/roles/${encodeURIComponent(roleId)}/permissions?${
          all ? "all=1" : "per_page=100&page=0"
        }`
      ),

    // --- USER DIRECT PERMS (filtrados por tu AUDIENCE en backend) ---
    getUserPermissions: (userId: string) =>
      authFetch(`/api/admin/auth0/users/${encodeURIComponent(userId)}/permissions`),

    grantPermissionsToUser: (userId: string, permissions: string[], apiIdentifier?: string) =>
      authFetch(`/api/admin/auth0/users/${encodeURIComponent(userId)}/permissions`, {
        method: "POST",
        body: JSON.stringify({ permissions, apiIdentifier }),
      }),

    revokePermissionsFromUser: (userId: string, permissions: string[], apiIdentifier?: string) =>
      authFetch(`/api/admin/auth0/users/${encodeURIComponent(userId)}/permissions`, {
        method: "DELETE",
        body: JSON.stringify({ permissions, apiIdentifier }),
      }),

    // --- PERMISOS catálogo (de tu API / audience) ---
    listApiPermissions: () => authFetch(`/api/admin/auth0/permissions`),

    // --- ROLES: assign/remove ---
    assignRolesToUser: (userId: string, roleIds: string[], orgId?: string) =>
      authFetch(`/api/admin/auth0/users/${encodeURIComponent(userId)}/roles`, {
        method: "POST",
        body: JSON.stringify({ roleIds, org_id: orgId || undefined }),
      }),

    removeRolesFromUser: (userId: string, roleIds: string[], orgId?: string) =>
      authFetch(`/api/admin/auth0/users/${encodeURIComponent(userId)}/roles`, {
        method: "DELETE",
        body: JSON.stringify({ roleIds, org_id: orgId || undefined }),
      }),
  };
}
