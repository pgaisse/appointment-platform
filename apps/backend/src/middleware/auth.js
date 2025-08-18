// apps/backend/src/middleware/auth.js
const { auth } = require('express-oauth2-jwt-bearer');
require('dotenv').config();

const DISABLE_AUTH = String(process.env.DISABLE_AUTH || '').toLowerCase() === 'true';

// Si quieres desactivar auth en dev:
if (DISABLE_AUTH) {
  console.warn('🔓 Auth deshabilitado (DISABLE_AUTH=true)');
  module.exports = (req, _res, next) => next();
  module.exports.attachUserInfo = (_req, _res, next) => next();
  module.exports.decodeToken = () => ({});
  return;
}

// Vars necesarias
const audience = process.env.AUTH0_AUDIENCE;
console.log('🔐 Usando AUTH0_AUDIENCE:', audience);
let issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL; // Debe ser algo como: https://dev-xxxxx.us.auth0.com/
console.log('🔐 Usando AUTH0_ISSUER_BASE_URL:', issuerBaseURL);
// Asegura que termine con '/'
if (issuerBaseURL && !issuerBaseURL.endsWith('/')) issuerBaseURL += '/';

if (!audience || !issuerBaseURL) {
  // Falla segura si falta config
  throw new Error("Faltan AUTH0_AUDIENCE o AUTH0_ISSUER_BASE_URL en el backend");
}

// ÚNICO middleware de validación de JWT (Auth0 oficial)
const jwtCheck = auth({
  audience,
  issuerBaseURL,           // 👈 clave correcta (camelCase)
  tokenSigningAlg: 'RS256',
});

// Adjunta info útil del token
const attachUserInfo = (req, _res, next) => {
  if (req.auth && req.auth.payload) {
    const p = req.auth.payload;
    req.user = {
      id: p.sub,
      role: p['https://letsmarter.com/role'],
      organization: p['https://letsmarter.com/organization'],
      org_name: p['https://iconicsmile.com/org_name'],
      email: p.email,
      name: p.name,
    };
  }
  next();
};

// (Opcional) Decodificador simple
function decodeToken(token) {
  if (!token || token.split('.').length !== 3) throw new Error('Token inválido');
  const payloadBase64 = token.split('.')[1];
  return JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
}

module.exports = { jwtCheck, attachUserInfo, decodeToken };
