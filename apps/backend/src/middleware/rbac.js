// apps/backend/src/middleware/rbac.js
const DISABLE_AUTH = String(process.env.DISABLE_AUTH || '').toLowerCase() === 'true';

/** ---------- utils ---------- **/

const norm = (v) => String(v ?? '').trim().toLowerCase();
const toLowerArr = (a) =>
  (Array.isArray(a) ? a : (a != null ? [a] : []))
    .map(norm)
    .filter(Boolean);

function uniq(arr) {
  const s = new Set();
  return arr.filter((x) => (s.has(x), !s.has(x)));
}

/** wildcard match: "card:*", "board:*:write" */
function matchesWithWildcard(pattern, value) {
  if (!pattern.includes('*')) return pattern === value;
  const esc = pattern
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${esc}$`).test(value);
}

function hasAll(required, haveSet) {
  return required.every((req) => haveSet.has(req) || Array.from(haveSet).some((h) => matchesWithWildcard(req, h)));
}
function hasAny(required, haveSet) {
  return required.some((req) => haveSet.has(req) || Array.from(haveSet).some((h) => matchesWithWildcard(req, h)));
}

/**
 * Unifica roles/permisos desde token (req.user) y/o DB (req.dbUser).
 * source:
 *  - 'token'  -> solo token
 *  - 'db'     -> solo DB
 *  - 'both'   -> unión token+DB
 *  - 'preferDb' (default) -> DB si hay algo, si no token
 */
function getAuthz(req, source = 'preferDb') {
  const tok = req.user || {};
  const db = req.dbUser || {};

  const tokRoles = toLowerArr(tok.roles);
  const tokPerms = toLowerArr(tok.permissions);
  const dbRoles  = toLowerArr(db.roles);
  const dbPerms  = toLowerArr(db.permissions);

  if (source === 'token') {
    return { roles: new Set(tokRoles), permissions: new Set(tokPerms), org_id: tok.org_id || null };
  }
  if (source === 'db') {
    return { roles: new Set(dbRoles), permissions: new Set(dbPerms), org_id: db.org_id || null };
  }
  if (source === 'both') {
    return {
      roles: new Set(uniq([...tokRoles, ...dbRoles])),
      permissions: new Set(uniq([...tokPerms, ...dbPerms])),
      org_id: db.org_id || tok.org_id || null,
    };
  }
  // preferDb
  const hasDbData = (dbRoles.length + dbPerms.length) > 0;
  return hasDbData ? getAuthz(req, 'db') : getAuthz(req, 'token');
}

function deny(res, reason, required, haveSet) {
  return res.status(403).json({
    error: 'forbidden',
    reason,
    required,
    have: Array.from(haveSet),
  });
}

/** ---------- builders por TOKEN/DB/BOTH ---------- **/

function _requireRole(requiredRoles, source = 'preferDb') {
  const reqd = toLowerArr(requiredRoles);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { roles } = getAuthz(req, source);
    if (hasAny(reqd, roles)) return next();
    return deny(res, `role_required_${source}`, reqd, roles);
  };
}

function _requireAll(requiredPerms, source = 'preferDb') {
  const reqd = toLowerArr(requiredPerms);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { permissions } = getAuthz(req, source);
    if (hasAll(reqd, permissions)) return next();
    return deny(res, `all_permissions_required_${source}`, reqd, permissions);
  };
}

function _requireAny(requiredPerms, source = 'preferDb') {
  const reqd = toLowerArr(requiredPerms);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { permissions } = getAuthz(req, source);
    if (hasAny(reqd, permissions)) return next();
    return deny(res, `any_permission_required_${source}`, reqd, permissions);
  };
}

function _forbid(bannedPerms, source = 'preferDb') {
  const banned = toLowerArr(bannedPerms);
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { permissions } = getAuthz(req, source);
    const hit = hasAny(banned, permissions);
    if (!hit) return next();
    return deny(res, `permission_forbidden_${source}`, banned, permissions);
  };
}

/** ---------- API pública (compat + variantes) ---------- **/

// Compat con tu código actual (fuente preferDb: usa DB si existe, si no token)
function requireRole(...requiredRoles)               { return _requireRole(requiredRoles, 'preferDb'); }
function requireAllPermissions(...perms)             { return _requireAll(perms, 'preferDb'); }
function requireAnyPermission(...perms)              { return _requireAny(perms, 'preferDb'); }
function forbidPermissions(...perms)                 { return _forbid(perms, 'preferDb'); }

// Variantes explícitas por fuente
const requireRoleDb               = (...r) => _requireRole(r, 'db');
const requireRoleToken            = (...r) => _requireRole(r, 'token');
const requireRoleBoth             = (...r) => _requireRole(r, 'both');

const requireAllPermissionsDb     = (...p) => _requireAll(p, 'db');
const requireAllPermissionsToken  = (...p) => _requireAll(p, 'token');
const requireAllPermissionsBoth   = (...p) => _requireAll(p, 'both');

const requireAnyPermissionDb      = (...p) => _requireAny(p, 'db');
const requireAnyPermissionToken   = (...p) => _requireAny(p, 'token');
const requireAnyPermissionBoth    = (...p) => _requireAny(p, 'both');

const forbidPermissionsDb         = (...p) => _forbid(p, 'db');
const forbidPermissionsToken      = (...p) => _forbid(p, 'token');
const forbidPermissionsBoth       = (...p) => _forbid(p, 'both');

/** (Opcional) exige que el usuario pertenezca a la misma org o sea admin */
function requireSameOrgOrRoleAdmin(orgResolver = (req) => req.params.org_id) {
  return (req, res, next) => {
    if (DISABLE_AUTH) return next();
    const { org_id, roles } = getAuthz(req, 'preferDb');
    const targetOrg = orgResolver(req);
    const isAdmin = roles.has('admin');
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
  // pickers
  getAuthz,

  // compat (preferDb)
  requireRole,
  requireAllPermissions,
  requireAnyPermission,
  forbidPermissions,
  requireSameOrgOrRoleAdmin,

  // variantes explícitas
  requireRoleDb,
  requireRoleToken,
  requireRoleBoth,

  requireAllPermissionsDb,
  requireAllPermissionsToken,
  requireAllPermissionsBoth,

  requireAnyPermissionDb,
  requireAnyPermissionToken,
  requireAnyPermissionBoth,

  forbidPermissionsDb,
  forbidPermissionsToken,
  forbidPermissionsBoth,
};
