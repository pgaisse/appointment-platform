const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
require('dotenv').config();
const sms = require('../helpers/conversations')

function setupSocket(server) {
  // ✅ Usamos AUTH0_DOMAIN o ISSUERBASEURL
  const rawDomain = process.env.AUTH0_DOMAIN || process.env.AUTH0_ISSUER_BASE_URL;

  if (!rawDomain) {
    throw new Error('❌ Debes definir AUTH0_DOMAIN o ISSUERBASEURL en tu archivo .env');
  }

  // 🔧 Limpiar el dominio (sin https:// ni / al final)
  const issuerBase = rawDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const jwksClient = jwks({
    jwksUri: `https://${issuerBase}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  });

  function getKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        //console.error('🧨 Error al obtener clave pública del JWKS:', err);
        return callback(new Error('Error obteniendo clave pública'));
      }
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  const io = socketIo(server, {
    cors: {
      origin: 'https://letsmarter.com:3004', // Cambia esto si tu frontend está en otro origen
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    //console.log('🛂 Token recibido:', token);

    if (!token || !token.startsWith('Bearer ')) {
      //console.warn('❌ Token ausente o mal formado');
      return next(new Error('Unauthorized'));
    }

    const rawToken = token.replace('Bearer ', '');

    jwt.verify(
      rawToken,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${issuerBase}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          console.error('❌ Token inválido:', err.message);
          return next(new Error('Unauthorized'));
        }

        socket.user = {
          id: decoded.sub,
          role: decoded['https://letsmarter.com/role'],
          org_name: decoded['https://iconicsmile.com/org_name'], // ✅ Aquí accedes correctamente
          org_id:decoded.org_id
        };

        //console.log(`✅ Socket autenticado: ${socket.user.id}`);
        next();
      }
    );
  });

  io.on('connection', (socket) => {
    const { id: userId, org_name,org_id } = socket.user;
    //console.log("este es org_id",org_id)
    if (!userId || !org_id) {
      console.warn('⛔ Falta userId u org_name en socket.user');
      return socket.disconnect(true);
    }


    const orgRoom = org_id.toLowerCase();
    socket.join(orgRoom);

    //console.log(`✅ Socket conectado: ${socket.id}`);
    //console.log(`🪪 Usuario: ${userId} | Organización: ${org_name}`);
    //console.log(`🔗 Room: ${orgRoom}`);

    // ✅ Escuchar mensajes desde frontend
    socket.on('smsSend', async (data) => {
      //console.log(data)
    });




    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
    });
  });



  return io;
}

module.exports = setupSocket;
