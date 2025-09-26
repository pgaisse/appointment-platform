// apps/backend/src/routes/profile.js
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const User = require('../models/User/User');

// GET /api/profile/me  → devuelve tokenUser + dbUser con forma estable
router.get('/me', requireAuth, async (req, res) => {
  try {
    const p = req.auth?.payload || {};
    const tokenUser = {
      id: p.sub || null,
      email: req.user?.email || null,
      emailVerified: req.user?.emailVerified === true,
      name: req.user?.name || null,
      picture: req.user?.picture || null,
      org_id: req.user?.org_id || null,
      orgs: req.user?.orgs || [],
      roles: req.user?.roles || [],
      permissions: req.user?.permissions || [],
      org_name: req.user?.org_name || null,
    };

    // req.dbUser lo setea ensureUser; si no, buscamos
    let dbUser = req.dbUser;
    if (!dbUser && tokenUser.id) {
      dbUser = await User.findOne({ auth0_id: tokenUser.id }).lean();
    }

    const stats = {
      rolesCount: (tokenUser.roles || []).length,
      permissionsCount: (tokenUser.permissions || []).length,
      orgsCount: (tokenUser.orgs || []).length,
    };

    res.json({
      ok: true,
      tokenUser,
      dbUser: dbUser || null,
      stats,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// PUT /api/profile  { name?, picture? }  → actualiza campos básicos del propio usuario
router.put('/', requireAuth, async (req, res) => {
  try {
    const auth0Id = req.user?.id;
    if (!auth0Id) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { name, picture } = req.body || {};
    const $set = {};
    if (typeof name === 'string') $set.name = name.trim().slice(0, 120);
    if (typeof picture === 'string') $set.picture = picture.trim();

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ ok: false, error: 'No fields to update' });
    }

    $set.updatedAt = new Date();

    const updated = await User.findOneAndUpdate(
      { auth0_id: auth0Id },
      { $set },
      { upsert: false, new: true }
    ).lean();

    res.json({ ok: true, user: updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

module.exports = router;
