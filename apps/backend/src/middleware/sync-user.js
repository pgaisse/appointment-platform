// apps/backend/src/middleware/sync-user.js
const User = require('../models/User/User');
const UserLoginAudit = require('../models/User/UserLoginAudit');

function getIp(req) {
  return (
    (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    ''
  );
}

function toArr(x) {
  if (Array.isArray(x)) return x;
  if (x == null) return [];
  return [x];
}

async function syncUserFromToken(req, _res, next) {
  try {
    const payload = req.auth?.payload || null;
    if (!payload?.sub) return next();

    // Prefer req.dbUser populated by ensureUser (non-lean), else fetch
    let userDoc = req.dbUser || (await User.findOne({ auth0_id: payload.sub }).lean(false));
    if (!userDoc) return next();

    const now = new Date();
    const ip = getIp(req);
    const ua = String(req.headers['user-agent'] || '');

    const jti = payload.jti || payload.jwtid || null;
    const iat = typeof payload.iat === 'number' ? payload.iat : null;

    const hasNewJti = jti && userDoc.lastTokenJti !== jti;
    const hasNewIat = iat && (!userDoc.lastTokenIat || iat > userDoc.lastTokenIat);
    const isNewLogin = Boolean(hasNewJti || hasNewIat || userDoc.loginCount === 0 || !userDoc.lastLoginAt);

    const $set = { lastAccessAt: now };
    const $inc = {};

    if (isNewLogin) {
      $set.lastLoginAt = now;
      $set.lastLoginIp = ip;
      $set.lastLoginUa = ua;
      if (jti) $set.lastTokenJti = jti;
      if (iat) $set.lastTokenIat = iat;
      $inc.loginCount = 1;
    }

    if (Object.keys($set).length || Object.keys($inc).length) {
      userDoc = await User.findByIdAndUpdate(
        userDoc._id,
        { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($inc).length ? { $inc } : {}) },
        { new: true }
      );
    }

    if (isNewLogin) {
      try {
        await UserLoginAudit.create({
          userId: userDoc._id,
          auth0_id: userDoc.auth0_id,
          email: userDoc.email,
          org_id: userDoc.org_id || null,
          org_name: req.user?.org_name || null,
          permissions: toArr(req.user?.permissions || []),
          ip,
          ua,
          tokenJti: jti || null,
          tokenIat: iat || null,
          event: 'login',
          at: now,
        });
      } catch (e) {
        console.warn('[syncUserFromToken] audit failed:', e?.message || e);
      }
    }

    req.dbUser = userDoc;
    next();
  } catch (err) {
    console.error('[syncUserFromToken] error:', err?.message || err);
    next();
  }
}

module.exports = { syncUserFromToken };
