// middleware/rbac-explain.js
const { requireAnyPermission: baseRequireAnyPerm } = require('./rbac');

function collectUserPerms(req) {
  const fromDb = Array.isArray(req.dbUser?.permissions) ? req.dbUser.permissions : [];
  const fromToken =
    (Array.isArray(req.auth?.permissions) && req.auth.permissions) ||
    (Array.isArray(req.user?.permissions) && req.user.permissions) ||
    [];
  return Array.from(new Set([...fromDb, ...fromToken]));
}

// Wrap the base middleware; on deny, return 403 with English JSON
function requireAnyPermissionExplain(...required) {
  const mw = baseRequireAnyPerm(...required);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (err) {
        res.set('X-Required-Permissions', required.join(','));
        return res.status(403).json({
          error: 'forbidden',
          code: 'insufficient_permissions',
          message: "You don't have permission to perform this action.",
          required,          // permissions required
          anyOf: true,       // only one of them was needed
          have: collectUserPerms(req),
          path: req.originalUrl,
          method: req.method,
          org_id: req.dbUser?.org_id ?? null,
        });
      }
      next();
    });
  };
}

module.exports = { requireAnyPermissionExplain };
