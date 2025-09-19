// apps/backend/src/routes/secure.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const NS = process.env.JWT_CLAIMS_NAMESPACE || 'https://letsmarter.com/';

router.get('/me', requireAuth, (req, res) => {
  res.json({
    ok: true,
    tokenUser: req.user,  // lo que vino del token (incluye roles/permissions)
    dbUser: req.dbUser,   // lo que se guardó/actualizó en Mongo
  });
});

router.get('/debug/jwt-info', requireAuth, (req, res) => {
  const p = req.auth?.payload || {};
  res.json({
    hasAuth: !!req.auth,
    iss: p.iss,
    aud: p.aud,
    sub: p.sub,
    org_id_ns: p[NS + 'org_id'] ?? null,
    org_id_top: p.org_id ?? null,
    roles_ns: p[NS + 'roles'] || [],
    roles_top: p.roles || [],
    perms_ns: p[NS + 'permissions'] || [],
    perms_top: p.permissions || [],
  });
});

module.exports = router;
