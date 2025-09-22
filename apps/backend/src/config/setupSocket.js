// apps/backend/src/config/setupSocket.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');

// ⬇️ Nuestro bus central para compartir la instancia de io
const { setIO } = require('../socket/bus');
// ⬇️ Helpers para rooms por organización SIEMPRE en minúsculas
const { orgRoom, normalizeOrgId } = require('../socket/org-util');

/**
 * Inicializa Socket.IO sobre el servidor HTTP/HTTPS
 * - Autenticación con Auth0 (RS256, JWKS)
 * - El usuario se une automáticamente al room de su organización (minúsculas)
 * - Logs útiles para depurar conexiones, joins y errores
 */
function setupSocket(server) {
  // Dominio issuer de Auth0 (admite AUTH0_DOMAIN o AUTH0_ISSUER_BASE_URL)
  const rawDomain = process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL;
  if (!rawDomain) {
    throw new Error('❌ Define AUTH0_DOMAIN o AUTH0_ISSUER_BASE_URL en .env');
  }
  // normaliza issuer sin protocolo ni slash final
  const issuer = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Cliente JWKS (claves públicas rotativas de Auth0)
  const jwksClient = jwks({
    jwksUri: `https://${issuer}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  });

  function getKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        //console.error('[SOCKET][JWKS] Error obteniendo clave pública:', err?.message || err);
        return callback(new Error('JWKS error'));
      }
      callback(null, key.getPublicKey());
    });
  }

  // Inicializa IO
  const io = socketIo(server, {
    cors: {
      origin: process.env.SERVER_URL, // Ajusta si tu frontend vive en otro origen
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Ajustes recomendados; puedes personalizar
    pingInterval: 20000,
    pingTimeout: 25000,
  });

  // Expone la instancia para otros módulos (bus de emisión)
  setIO(io);

  // Log de errores de engine (CORS/handshake/transporte)
  io.engine.on('connection_error', (err) => {
    //console.error('[SOCKET][ENGINE ERROR]', {
    //  code: err.code,
     // message: err.message,
     // context: err.context,
    //});
  });

  // Middleware de autenticación por socket (handshake)
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token;
      if (!raw || !raw.startsWith('Bearer ')) {
        return next(new Error('Unauthorized'));
      }
      const token = raw.slice(7);

      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: `https://${issuer}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            //console.error('[SOCKET][AUTH] Token inválido:', err.message);
            return next(new Error('Unauthorized'));
          }

          // Busca org_id en distintos namespaces
          const orgRaw =
            decoded.org_id ||
            decoded['https://iconicsmile.com/org_id'] ||
            decoded['https://letsmarter.com/org_id'];

          socket.user = {
            id: decoded.sub,
            org_id: normalizeOrgId(orgRaw), // ⚠️ SIEMPRE en minúsculas
          };

          if (!socket.user.org_id) {
            //console.warn('[SOCKET][AUTH] org_id ausente en token');
          }
          next();
        }
      );
    } catch (e) {
      //console.error('[SOCKET][AUTH] Error inesperado:', e?.message || e);
      next(new Error('Unauthorized'));
    }
  });

  // Conexión del cliente
  io.on('connection', (socket) => {
    const { id: userId, org_id } = socket.user || {};
    //console.log('[SOCKET][CONNECT]', { socketId: socket.id, userId, org_id });

    if (!org_id) {
      //console.warn('[SOCKET] org_id vacío → disconnect');
      socket.disconnect(true);
      return;
    }

    // Únete al room de la organización (minúsculas)
    const room = orgRoom(org_id);
    socket.join(room);
   // console.log('[SOCKET][JOIN]', { socketId: socket.id, room });

    // Escucha genérica (útil al depurar; puedes silenciar en prod)
    socket.onAny((event, ...args) => {
      if (process.env.SOCKET_VERBOSE === '1') {
        const preview = (() => {
          try { return JSON.stringify(args)?.slice(0, 300); }
          catch { return '[unserializable]'; }
        })();
        //console.log('[SOCKET][IN]', event, { from: socket.id, argsPreview: preview });
      }
    });

    socket.on('disconnect', (reason) => {
      //console.log('[SOCKET][DISCONNECT]', { socketId: socket.id, reason });
    });

    socket.on('error', (e) => {
     // console.error('[SOCKET][CLIENT ERROR]', e?.message || e);
    });
  });

  return io;
}

module.exports = setupSocket;
