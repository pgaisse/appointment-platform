// apps/backend/src/routes/users.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');         // tu cadena: jwtCheck + attachUserInfo + ensureUser
const { requireRole } = require('../middleware/rbac');         // nuevo
const router = express.Router();

/**
const { requireAnyPermission, requireAllPermissions } = require('../middleware/rbac');

router.get('/', requireAnyPermission('users:read', 'admin:all'), handlerList);
router.post('/', requireAllPermissions('users:write'), handlerCreate);

 */

// 🔐 Todo /users solo para Admin
router.use(requireAuth, requireRole('admin'));

// GET /api/users
router.get('/', async (req, res) => {
    const User = require('../models/User/User');
    const users = await User.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ ok: true, users });
});

// Otros endpoints también quedan protegidos por el requireRole('admin')
router.post('/', async (req, res) => { /* crear usuario */ res.json({ ok: true }); });
router.patch('/:id', async (req, res) => { /* actualizar */ res.json({ ok: true }); });
router.delete('/:id', async (req, res) => { /* eliminar */ res.json({ ok: true }); });

module.exports = router;
