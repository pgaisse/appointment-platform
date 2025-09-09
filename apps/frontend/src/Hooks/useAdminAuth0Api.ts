// src/api/adminAuth0.ts

import { useAuthFetch } from "@/api/authFetch";

export function useAdminAuth0Api() {
    const { authFetch } = useAuthFetch();

    return {
        searchUsers: (q = "", page = 0, perPage = 20, orgId?: string) =>
            authFetch(
                `/api/admin/auth0/users?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}${orgId ? `&org_id=${encodeURIComponent(orgId)}` : ""
                }`
            ),

        listRoles: () => authFetch(`/api/admin/auth0/roles`),

        getUserRoles: (userId: string, orgId?: string) =>
            authFetch(
                `/api/admin/auth0/users/${encodeURIComponent(userId)}/roles${orgId ? `?org_id=${encodeURIComponent(orgId)}` : ""
                }`
            ),

        // Permisos del usuario (filtrados a tu audience)
        getUserDirectPermissions: (userId: string) =>
            authFetch(`api/users/${encodeURIComponent(userId)}/permissions`),
        // ⬇️ PERMISOS de un ROL (lo que faltaba)
        getRolePermissions: (roleId: string, all = true) =>
            authFetch(`$/api/roles/${encodeURIComponent(roleId)}/permissions?${all ? 'all=1' : 'per_page=100&page=0'}`),
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

        // (si manejas permisos directos, opcional)
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
        listApiPermissions: () => authFetch(`/api/admin/auth0/auth0/permissions`),
    };
}
