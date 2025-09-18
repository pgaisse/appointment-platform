// apps/backend/src/routes/users.js
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { requireRole, requireAnyPermission } = require('../middleware/rbac');

// Modelo
const User = require('../models/User/User');

// ───────────────────────────────────────────────────────────
// ✅ Auth obligatorio
router.use(requireAuth);

// ✅ Gate: admin (rol) O permiso user:read (ó dev-admin)
//    - Si tiene rol admin -> pasa
//    - Si no, exige permiso user:read (o dev-admin)
router.use((req, res, next) => {
  const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
  if (roles.includes('admin')) return next();
  // delega a requireAnyPermission si no es admin
  return requireAnyPermission('user:read', 'dev-admin')(req, res, next);
});

// ───────────────────────────────────────────────────────────
// GET /api/users
// Opcional: soporte de paginación y búsqueda simple (?q=texto&limit=50&page=0)
router.get('/', async (req, res) => {
  try {
    const { q = '', limit = 100, page = 0 } = req.query;

    const lim = Math.min(Number(limit) || 100, 200);
    const skip = (Number(page) || 0) * lim;

    const filter = q
      ? {
          $or: [
            { name:   { $regex: String(q), $options: 'i' } },
            { email:  { $regex: String(q), $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean();

    res.json({ ok: true, users });
  } catch (e) {
    console.error('[GET /users] ERROR:', e?.message, e?.stack || '');
    res.status(500).json({ ok: false, error: e?.message || 'Internal Server Error' });
  }
});

// ───────────────────────────────────────────────────────────
// Para crear/editar/eliminar, puedes exigir permisos más fuertes.
// Ejemplo: solo admin o permiso user:write (ajústalo a tu modelo RBAC).
router.post('/',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:write', 'dev-admin')(req, res, next);
  },
  async (req, res) => {
    // implementar creación si la usas
    res.json({ ok: true });
  }
);

router.patch('/:id',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:write', 'dev-admin')(req, res, next);
  },
  async (req, res) => {
    // implementar actualización si la usas
    res.json({ ok: true });
  }
);

router.delete('/:id',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:write', 'dev-admin')(req, res, next);
  },
  async (req, res) => {
    // implementar borrado si la usas
    res.json({ ok: true });
  }
);

module.exports = router;
