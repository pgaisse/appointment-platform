// apps/backend/src/middleware/auth.js
const { auth } = require('express-oauth2-jwt-bearer');
require('dotenv').config();

const DISABLE_AUTH = String(process.env.DISABLE_AUTH || '').toLowerCase() === 'true';

// Normaliza el namespace para que termine en "/"
let NS = process.env.JWT_CLAIMS_NAMESPACE || 'https://letsmarter.com/';
if (!NS.endsWith('/')) NS += '/';

// ---------------------------
// (Opcional) Decodificador simple (sin verificar firma)
// ---------------------------
function decodeToken(token) {
  if (!token || token.split('.').length !== 3) throw new Error('Token inválido');
  const payloadBase64Url = token.split('.')[1];
  const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
}

// ---------------------------
// DEV: modo sin auth (bypass)
// ---------------------------
if (DISABLE_AUTH) {
  //console.warn('🔓 Auth deshabilitado (DISABLE_AUTH=true)');

  const pass = (_req, _res, next) => next();

  module.exports = {
    jwtCheck: pass,
    attachUserInfo: pass,
    ensureUser: pass,
    requireAuth: [pass, pass, pass],
    decodeToken,
  };
  return;
}

// ---------------------------
// Config Auth0 obligatoria
// ---------------------------
const audience = process.env.AUTH0_AUDIENCE;
let issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL; // p.ej. https://dev-xxxxx.us.auth0.com
if (issuerBaseURL && !issuerBaseURL.endsWith('/')) issuerBaseURL += '/';
if (!audience || !issuerBaseURL) {
  throw new Error('Faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL en el backend');
}
if (process.env.NODE_ENV !== 'production') {
  //console.log('🔐 AUTH0_AUDIENCE:', audience);
  //console.log('🔐 AUTH0_ISSUER_BASE_URL:', issuerBaseURL);
}

// ---------------------------
// Middleware de validación
// ---------------------------
const jwtCheck = auth({
  audience,
  issuerBaseURL,
  tokenSigningAlg: 'RS256',
  clockTolerance: 5, // tolerancia por skew de reloj (segundos)
});

// ---------------------------
// Validación de duración máxima de sesión (10 horas)
// ---------------------------
const MAX_SESSION_DURATION_SECONDS = 10 * 60 * 60; // 10 horas

const validateSessionDuration = (req, res, next) => {
  if (!req.auth || !req.auth.payload) return next();
  
  const payload = req.auth.payload;
  const iat = payload.iat; // Issued at time
  const now = Math.floor(Date.now() / 1000);
  
  if (!iat) {
    console.warn('[validateSessionDuration] Token sin campo iat (issued at)');
    return next();
  }
  
  const sessionAge = now - iat;
  
  if (sessionAge > MAX_SESSION_DURATION_SECONDS) {
    console.warn(`[validateSessionDuration] Session exceeded 10 hours. Age: ${Math.floor(sessionAge / 3600)} hours`);
    return res.status(401).json({
      error: 'session_expired',
      message: 'Your session has exceeded the maximum duration of 10 hours. Please log in again.',
      code: 'SESSION_TIMEOUT',
      sessionAge: Math.floor(sessionAge / 3600) // horas
    });
  }
  
  // Advertir si quedan menos de 30 minutos
  const remainingSeconds = MAX_SESSION_DURATION_SECONDS - sessionAge;
  if (remainingSeconds < 30 * 60 && remainingSeconds > 0) {
    res.set('X-Session-Warning', `Session expires in ${Math.floor(remainingSeconds / 60)} minutes`);
  }
  
  next();
};

// Helper para obtener claims con/sin namespace
function claim(p, key) {
  return p?.[NS + key] ?? p?.[key];
}

// ---------------------------
// Adjunta info útil del token
// ---------------------------
function mergeArrClaims(p, key) {
  const a = p?.[NS + key];
  const b = p?.[key];
  const arrA = Array.isArray(a) ? a : (a != null ? [a] : []);
  const arrB = Array.isArray(b) ? b : (b != null ? [b] : []);
  const seen = new Set();
  return [...arrA, ...arrB].filter(v => {
    if (v == null) return false;
    const s = String(v);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}


const attachUserInfo = (req, _res, next) => {
  if (!req.auth || !req.auth.payload) return next();
  const p = req.auth.payload;
//console.log("PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",p['https://letsmarter.com/email'])
  req.user = {
    id: p.sub,
    email: p['https://letsmarter.com/email'],
    emailVerified: p.email_verified === true,
    name: p['https://letsmarter.com/name'],
    picture: p.picture || null,

    org_id: p[NS + 'org_id'] ?? p.org_id ?? null,
    orgs: (Array.isArray(p[NS + 'orgs']) && p[NS + 'orgs'].length)
      ? p[NS + 'orgs']
      : (p.org_id ? [p.org_id] : []),

    // 👇 AHORA SÍ: merge de ambos orígenes
    roles: mergeArrClaims(p, 'roles'),
    permissions: mergeArrClaims(p, 'permissions'),

    // compat opcional con claves antiguas
    role: p[NS + 'role'],
    organization: p[NS + 'organization'],
    org_name: p['https://iconicsmile.com/org_name'],
  };
//console.log("RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRREQ",req.user)
  // Debug opcional:
  // console.log('[attachUserInfo] roles=%j perms=%j', req.user.roles, req.user.permissions);

  next();
};

// ---------------------------
// JIT provisioning en Mongo
// ---------------------------
const ensureUser = async (req, _res, next) => {
  try {
    if (!req.auth || !req.auth.payload) {
      //console.warn('[ensureUser] NO req.auth.payload');
      return next();
    }
    const p = req.auth.payload;
    p.email = p.email || p[NS + 'email'] || null; // normaliza email
    p.name = p.name || p[NS + 'name'] || null;    // normaliza name
    if (process.env.NODE_ENV !== 'production') {
      //console.log('[ensureUser] sub=%s email=%s aud=%s', p.sub, p.email, p.aud);
    }

    const User = require('../models/User/User');
    const doc = await User.upsertFromClaims(p, NS);

    if (process.env.NODE_ENV !== 'production') {
     // console.log('[ensureUser] UPSERT OK -> _id=%s auth0_id=%s org_id=%s',
      //  doc?._id, doc?.auth0_id, doc?.org_id);
    }
    req.dbUser = doc;
    next();
  } catch (err) {
    console.error('[ensureUser] ERROR:', err);
    next();
  }
};

// Composición lista para usar en rutas protegidas
const { syncUserFromToken } = require('./sync-user');
const requireAuth = [jwtCheck, validateSessionDuration, attachUserInfo, ensureUser, syncUserFromToken];

module.exports = { 
  jwtCheck, 
  attachUserInfo, 
  ensureUser, 
  requireAuth, 
  decodeToken,
  validateSessionDuration 
};
