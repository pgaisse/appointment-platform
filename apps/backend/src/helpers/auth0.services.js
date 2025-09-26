const User = require('../models/User/User');

// --- Helpers de sincronización con Auth0 ---
async function listAllRolePermissions(roleId, audience) {
  // pagina todas las permissions de un rol y filtra por tu API (audience)
  let permissions = [];
  let page = 0;
  while (true) {
    const batch = await callMgmt(
      `/roles/${encodeURIComponent(roleId)}/permissions?per_page=100&page=${page}`
    );
    const arr = Array.isArray(batch) ? batch : (batch?.permissions || []);
    permissions = permissions.concat(arr);
    if (!Array.isArray(arr) || arr.length < 100) break;
    page++;
  }
  // filtrar a tu Resource Server
  return permissions
    .filter(p => p.resource_server_identifier === process.env.AUTH0_AUDIENCE)
    .map(p => p.permission_name);
}

async function getUserDirectPermissions(userId) {
  // permisos directos del usuario, filtrados a tu audience
  let perms = [];
  let page = 0;
  while (true) {
    const batch = await callMgmt(
      `/users/${encodeURIComponent(userId)}/permissions?per_page=100&page=${page}`
    );
    const arr = Array.isArray(batch) ? batch : (batch?.permissions || []);
    perms = perms.concat(arr);
    if (!Array.isArray(arr) || arr.length < 100) break;
    page++;
  }
  return perms
    .filter(p => p.resource_server_identifier === process.env.AUTH0_AUDIENCE)
    .map(p => p.permission_name);
}

async function getUserRoles(userId, org_id) {
  const path = org_id
    ? `/organizations/${encodeURIComponent(org_id)}/members/${encodeURIComponent(userId)}/roles`
    : `/users/${encodeURIComponent(userId)}/roles`;
  // Devuelve roles “crudos” de Auth0
  const roles = await callMgmt(path);
  return Array.isArray(roles) ? roles : (roles?.roles || []);
}

async function computeRolePermissionsForUser(roles) {
  // une permisos (de tu audience) provenientes de TODOS los roles
  const audience = process.env.AUTH0_AUDIENCE;
  const all = await Promise.all(
    roles.map(r => listAllRolePermissions(r.id || r.role_id || r, audience))
  );
  return Array.from(new Set(all.flat()));
}

/**
 * Sincroniza el doc de DB con:
 *  - roles: nombres de los roles actuales
 *  - permissions: permisos efectivos = directos + por roles (filtrado a tu API)
 * Devuelve { dbUser, roles, directPermissions, rolePermissions, effectivePermissions }
 */
async function syncUserFromAuth0(userId, org_id) {
  const roles = await getUserRoles(userId, org_id);
  const roleNames = roles.map(r => r.name).filter(Boolean);

  const [directPermissions, rolePermissions] = await Promise.all([
    getUserDirectPermissions(userId),
    computeRolePermissionsForUser(roles),
  ]);

  const effective = Array.from(new Set([...directPermissions, ...rolePermissions]));

  // Actualiza DB (guardamos permisos efectivos y los roles por nombre)
  const dbUser = await User.findOneAndUpdate(
    { auth0_id: userId },
    { $set: { roles: roleNames, permissions: effective, lastLoginAt: new Date() } },
    { upsert: true, new: true }
  ).lean(false);

  return {
    dbUser,
    roles: roleNames,
    directPermissions,
    rolePermissions,
    effectivePermissions: effective,
  };
}
