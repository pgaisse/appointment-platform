// apps/backend/src/routes/auth0-sync.js
const crypto = require('crypto');
const express = require('express');
const User = require('../models/User/User');
const router = express.Router();

function verifySignature(rawBody, signatureHex, secret) {
  if (!signatureHex) return false;
  const mac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(signatureHex));
}

router.post(
  '/auth0/sync',
  express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }),
  async (req, res) => {
    try {
      const sig = req.get('X-Auth0-Signature');
      const ok = verifySignature(req.rawBody, sig, process.env.AUTH0_ACTIONS_WEBHOOK_SECRET);
      if (!ok) return res.status(401).json({ error: 'bad_signature' });

      const { user } = req.body || {};
      if (!user?.user_id) return res.status(400).json({ error: 'bad_payload' });

      const doc = await User.upsertFromActionUser(user);
      return res.json({ ok: true, _id: doc._id, auth0_id: doc.auth0_id });
    } catch (e) {
      console.error('[auth0/sync] error:', e);
      return res.status(500).json({ error: 'sync_failed' });
    }
  }
);

module.exports = router;
