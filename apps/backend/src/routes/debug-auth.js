// apps/backend/src/routes/debug-auth.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { decodeToken } = require('../middleware/auth');
const User = require('../models/User/User');
const { attachSignedUrls } = require('../helpers/user.helpers');
const router = express.Router();

// Echo del header (sin auth)
router.get('/debug/echo-auth', (req, res) => {
  res.json({
    hasAuth: !!req.headers.authorization,
    authSnippet: (req.headers.authorization || '').slice(0, 30),
  });
});

// Ver payload del JWT (sin verificar) - para confirmar sub/aud/iss que llegan
router.get('/debug/jwt-info', (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(400).json({ error: 'no_token' });
    const p = decodeToken(token);
    res.json({ sub: p.sub, aud: p.aud, iss: p.iss, exp: p.exp, iat: p.iat, org_id: p.org_id });
  } catch (e) {
    res.status(400).json({ error: 'decode_failed', message: String(e) });
  }
});

// Fuerza el JIT y devuelve el doc (VALIDA TOKEN)
router.get('/debug/jit', requireAuth, async (req, res) => {
  try {
    const p = req.auth?.payload;
    if (!p) return res.status(401).json({ error: 'no_auth_payload' });
    const doc = await User.upsertFromClaims(p, process.env.JWT_CLAIMS_NAMESPACE || 'https://letsmarter.com/');
    res.json({ ok: true, auth_sub: p.sub, user: { _id: doc._id, auth0_id: doc.auth0_id, email: doc.email, org_id: doc.org_id } });
  } catch (e) {
    console.error('[debug/jit] upsert error:', e);
    res.status(500).json({ ok: false, error: 'upsert_failed', message: String(e?.message || e) });
  }
});

// Lista rápida: ¿hay docs? (sin auth para inspección)
router.get('/debug/users', async (_req, res) => {
  const docs = await User.find().sort({ createdAt: -1 }).limit(5).lean();
  const count = await User.countDocuments();
  // Generate signed URLs for user pictures
  const docsWithUrls = await attachSignedUrls(docs);
  res.json({ count, docs: docsWithUrls });
});

module.exports = router;
