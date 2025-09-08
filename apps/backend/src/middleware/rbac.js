// apps/backend/src/middleware/rbac.js
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || '').toLowerCase() === 'true';

/** Normaliza arrays en minúsculas sin falsy */
function toLowerArr(a) {
  return (Array.isArray(a) ? a : [])
    .map(x => (x == null ? '' : String(x)))
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Extrae roles/permisos desde req.dbUser (preferente) o req.user (JWT) */
function pickAuthSubject(req) {
  const u = req.dbUser || req.user || {};
  return {
    roles: toLowerArr(u.roles),
    permissions: toLowerArr(u.permissions),
    org_id: u.org_id || null,
  };
}

/** Requiere al menos uno de estos roles */
function requireRole(...requiredRoles) {
  const required = toLowerArr(requiredRoles);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next(); // bypass en dev si así se configuró
    const { roles } = pickAuthSubject(req);
    const ok = required.some(r => roles.includes(r));
    if (!ok) {
      return res.status(403).json({
        error: 'forbidden',
        reason: 'missing_role',
        required_roles: requiredRoles,
        have_roles: roles,
      });
    }
    next();
  };
}

/** Requiere TODAS estas permissions */
function requireAllPermissions(...perms) {
  const required = toLowerArr(perms);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { permissions } = pickAuthSubject(req);
    const have = new Set(permissions);
    const missing = required.filter(p => !have.has(p));
    if (missing.length) {
      return res.status(403).json({
        error: 'forbidden',
        reason: 'missing_permissions',
        missing,
        have_permissions: permissions,
      });
    }
    next();
  };
}

/** Requiere AL MENOS UNA de estas permissions */
function requireAnyPermission(...perms) {
  const required = toLowerArr(perms);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { permissions } = pickAuthSubject(req);
    const have = new Set(permissions);
    const ok = required.some(p => have.has(p));
    if (!ok) {
      return res.status(403).json({
        error: 'forbidden',
        reason: 'missing_any_permission',
        required_any: required,
        have_permissions: permissions,
      });
    }
    next();
  };
}

/** (Opcional) exige que el usuario pertenezca a la misma org o sea Admin */
function requireSameOrgOrRoleAdmin(orgResolver = (req) => req.params.org_id) {
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { org_id, roles } = pickAuthSubject(req);
    const targetOrg = orgResolver(req);
    const isAdmin = roles.includes('admin');
    if (!isAdmin && targetOrg && org_id && targetOrg !== org_id) {
      return res.status(403).json({
        error: 'forbidden',
        reason: 'org_mismatch',
        user_org_id: org_id,
        target_org_id: targetOrg,
      });
    }
    next();
  };
}

module.exports = {
  requireRole,
  requireAllPermissions,
  requireAnyPermission,
  requireSameOrgOrRoleAdmin,
};
