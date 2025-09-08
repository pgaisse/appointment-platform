// src/api/adminAuth0.ts
import { useAuthFetch } from "./authFetch";

export function useAdminAuth0Api() {
    const { authFetch } = useAuthFetch();
    const base = `/api/admin/auth0`;

    return {
        // Usuarios
        searchUsers: (q = "", page = 0, perPage = 20) =>
            authFetch(`${base}/users?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`),

        // Roles
        listRoles: (opts?: { all?: boolean; page?: number; perPage?: number }) => {
            const all = opts?.all ?? true; // por defecto, trae todos
            const page = opts?.page ?? 0;
            const perPage = Math.min(opts?.perPage ?? 100, 100);
            const q = all ? `all=1` : `page=${page}&per_page=${perPage}`;
            return authFetch(`${base}/roles?${q}`);
        },
        getUserRoles: (userId: string) => authFetch(`${base}/users/${encodeURIComponent(userId)}/roles`),
        assignRolesToUser: (userId: string, roleIds: string[], orgId?: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/roles`, {
                method: "POST",
                body: JSON.stringify({ roleIds, org_id: orgId || undefined }),
            }),
        removeRolesFromUser: (userId: string, roleIds: string[], orgId?: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/roles`, {
                method: "DELETE",
                body: JSON.stringify({ roleIds, org_id: orgId || undefined }),
            }),
        // ⬇️ PERMISOS de un ROL (lo que faltaba)
        getRolePermissions: (roleId: string, all = true) =>
            authFetch(`${base}/roles/${encodeURIComponent(roleId)}/permissions?${all ? 'all=1' : 'per_page=100&page=0'}`),


        // Catálogo de permisos (tu API / audience)
        listApiPermissions: () => authFetch(`${base}/permissions`), // alias de /api-permissions

        // Permisos del usuario (filtrados a tu audience)
        getUserDirectPermissions: (userId: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/permissions`),

        // Alias por compatibilidad con tu código previo
        getUserPermissions: (userId: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/permissions`),

        // Otorgar / Revocar permisos DIRECTOS (lo recomendado es via roles, pero esto sirve para excepciones)
        grantPermissionsToUser: (userId: string, permissions: string[], apiIdentifier?: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/permissions`, {
                method: "POST",
                body: JSON.stringify({ permissions, apiIdentifier }),
            }),
        revokePermissionsFromUser: (userId: string, permissions: string[], apiIdentifier?: string) =>
            authFetch(`${base}/users/${encodeURIComponent(userId)}/permissions`, {
                method: "DELETE",
                body: JSON.stringify({ permissions, apiIdentifier }),
            }),

    };
}
