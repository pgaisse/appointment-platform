// apps/backend/src/routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const { requireAuth } = require('../middleware/auth');
const { requireRole, requireAnyPermission } = require('../middleware/rbac');
const UserLoginAudit = require('../models/User/UserLoginAudit');
const { uploadFileFromBuffer, getSignedUrl } = require('../helpers/aws');
const { attachSignedUrls } = require('../helpers/user.helpers');

// Modelo
const User = require('../models/User/User');

// Multer config for avatar uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const isMimeOk = /^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype);
    const isExtOk = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    if (isMimeOk && isExtOk) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
  }
});

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

    // Convert S3 keys to signed URLs
    const usersWithSignedUrls = await attachSignedUrls(users);

    res.json({ ok: true, users: usersWithSignedUrls });
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
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Only allow updating specific fields (not Auth0-managed fields like auth0_id, email, emailVerified)
      const allowedFields = [
        'name', 'status', 'picture',
        'firstName', 'lastName', 'phone', 'mobile',
        'position', 'department', 'location',
        'timezone', 'language', 'bio',
        'website', 'linkedin',
        'emailNotifications', 'smsNotifications'
      ];
      
      const sanitizedUpdates = {};
      for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
          sanitizedUpdates[field] = updates[field];
        }
      }
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid fields to update' });
      }
      
      const user = await User.findByIdAndUpdate(
        id,
        { $set: sanitizedUpdates },
        { new: true, runValidators: true }
      ).lean();
      
      if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      
      // Convert S3 key to signed URL if needed
      const userWithSignedUrl = await attachSignedUrls(user);
      
      res.json({ ok: true, user: userWithSignedUrl });
    } catch (e) {
      console.error('[PATCH /users/:id] ERROR:', e?.message);
      res.status(500).json({ ok: false, error: e?.message || 'Internal server error' });
    }
  }
);

router.delete('/:id',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:write', 'dev-admin')(req, res, next);
  },
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { status: 'blocked' } },
        { new: true }
      ).lean();
      
      if (!user) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      
      // Generate signed URL for user picture
      const userWithSignedUrl = await attachSignedUrls(user);
      
      res.json({ ok: true, message: 'User blocked successfully', user: userWithSignedUrl });
    } catch (e) {
      console.error('[DELETE /users/:id] ERROR:', e?.message);
      res.status(500).json({ ok: false, error: e?.message || 'Internal server error' });
    }
  }
);

// POST /api/users/:id/avatar - Upload user avatar
router.post('/:id/avatar',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:write', 'dev-admin')(req, res, next);
  },
  upload.single('avatar'),
  async (req, res) => {
    try {
      console.log('📤 [Avatar Upload] Starting for user:', req.params.id);
      const { id } = req.params;
      
      if (!req.file) {
        console.log('❌ [Avatar Upload] No file received');
        return res.status(400).json({ ok: false, error: 'No file uploaded' });
      }

      console.log('📁 [Avatar Upload] File received:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Upload to S3 (same as chat images)
      console.log('☁️  [Avatar Upload] Uploading to S3...');
      const key = await uploadFileFromBuffer(
        req.file.buffer,
        'avatars', // folder name in S3
        {
          contentType: req.file.mimetype,
          originalName: req.file.originalname,
          prefix: `user-${id}-`,
        }
      );
      console.log('✅ [Avatar Upload] S3 key generated:', key);

      // CRITICAL: Save the S3 key to the database (not the signed URL)
      console.log('💾 [Avatar Upload] Saving key to database...');
      const user = await User.findByIdAndUpdate(
        id,
        { $set: { picture: key } }, // Save the key, not signed URL
        { new: true }
      ).lean();

      if (!user) {
        console.log('❌ [Avatar Upload] User not found:', id);
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      console.log('✅ [Avatar Upload] User updated in DB with picture key:', user.picture);

      // Generate signed URL for immediate response (like chat does)
      console.log('🔐 [Avatar Upload] Generating signed URL...');
      const signedUrl = await getSignedUrl(key);
      console.log('✅ [Avatar Upload] Signed URL generated');

      res.json({ 
        ok: true, 
        user: {
          ...user,
          picture: signedUrl // Send signed URL in response for immediate display
        },
        message: 'Avatar uploaded successfully' 
      });
    } catch (e) {
      console.error('❌ [POST /users/:id/avatar] ERROR:', e?.message, e?.stack);
      res.status(500).json({ ok: false, error: e?.message || 'Failed to upload avatar' });
    }
  }
);

module.exports = router;

// ───────────────────────────────────────────────────────────
// GET /api/users/audit  → listar auditoría de logins
// Filtros opcionales:
//   - q: string (busca por email o auth0_id)
//   - userId: ObjectId del User
//   - auth0_id: string exacto
//   - email: string (regex i)
//   - from, to: ISO date range
//   - limit, page: paginación
// Acceso: admin role o permiso user:audit:read o dev-admin
router.get('/audit',
  (req, res, next) => {
    const roles = Array.isArray(req.dbUser?.roles) ? req.dbUser.roles : [];
    if (roles.includes('admin')) return next();
    return requireAnyPermission('user:audit:read', 'dev-admin')(req, res, next);
  },
  async (req, res) => {
    try {
      const {
        q = '',
        userId,
        auth0_id,
        email,
        from,
        to,
        limit = 100,
        page = 0,
        sort = 'at',
        order = 'desc',
      } = req.query;

      const lim = Math.min(Number(limit) || 100, 500);
      const skip = (Number(page) || 0) * lim;

      const filter = {};
      if (q) {
        filter.$or = [
          { email: { $regex: String(q), $options: 'i' } },
          { auth0_id: { $regex: String(q), $options: 'i' } },
        ];
      }
      if (userId) filter.userId = userId;
      if (auth0_id) filter.auth0_id = auth0_id;
      if (email) filter.email = { $regex: String(email), $options: 'i' };

      if (from || to) {
        filter.at = {};
        if (from) filter.at.$gte = new Date(String(from));
        if (to) filter.at.$lte = new Date(String(to));
      }

      const orderNum = String(order).toLowerCase() === 'asc' ? 1 : -1;
      const sortBy = { [sort || 'at']: orderNum, _id: -1 };

      const [items, total] = await Promise.all([
        UserLoginAudit.find(filter).sort(sortBy).skip(skip).limit(lim).lean(),
        UserLoginAudit.countDocuments(filter),
      ]);

      res.json({
        ok: true,
        items,
        pagination: {
          total,
          page: Number(page) || 0,
          limit: lim,
          hasMore: skip + items.length < total,
          sort: { field: sort || 'at', order: orderNum === 1 ? 'asc' : 'desc' },
        },
      });
    } catch (e) {
      console.error('[GET /users/audit] ERROR:', e?.message, e?.stack || '');
      res.status(500).json({ ok: false, error: e?.message || 'Internal Server Error' });
    }
  }
);
