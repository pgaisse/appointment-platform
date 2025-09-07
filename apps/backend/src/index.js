// index.js
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const qs = require('qs');

const Routes = require('./routes/index');
const SMS = require('./routes/sms');
const Topics = require('./routes/topics.routes');
const Socket = require('./routes/socket');
const mongoConnect = require('./config/db');
const setupSocket = require('./config/setupSocket');

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;
const useHttps = String(process.env.USE_HTTPS || '').toLowerCase() === 'true';

// -------- Middlewares base --------
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Query params complejos (evita petar si _parsedUrl no existe)
app.use((req, _res, next) => {
  console.log("➡️ Request entrante:", req.method, req.originalUrl);
  try { req.query = qs.parse(req._parsedUrl?.query || ''); } catch {}
  next();
});

// Healthcheck muy arriba (sin auth)
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev', time: new Date().toISOString() });
});

// Inyectar io en req
const server = http.createServer(app);
const io = setupSocket(server);
app.use((req, res, next) => { req.io = io; next(); });

// -------- Rutas --------
app.use("/api",SMS);
app.use('/api', require('./routes/secure'));      // ejemplo
app.use('/api', require('./routes/auth0-sync'));  // webhook de Action
app.use("/api",Routes);
+app.use('/api', require('./routes/debug-auth'));  // 👈 añade esto
app.use("/api",Topics);
app.use("/api/socket.io",Socket);
app.enable("trust proxy");

// -------- Server + Socket.IO --------
// al iniciar tu app (server.js o donde cargas .env)
console.log('DISABLE_AUTH =', process.env.DISABLE_AUTH);
console.log('AUTH0_AUDIENCE =', process.env.AUTH0_AUDIENCE);
console.log('AUTH0_ISSUER_BASE_URL =', process.env.AUTH0_ISSUER_BASE_URL);
app.use((err, req, res, next) => {
  if (err && err.name === 'UnauthorizedError') {
    console.error('[jwtCheck 401]', { code: err.code, message: err.message, inner: err.inner?.message });
    return res.status(401).json({ error: 'unauthorized', code: err.code, message: err.message, inner: err.inner?.message });
  }
  next(err);
});




// Conexión DB
mongoConnect();

// Escuchar (un solo server!)
server.listen(port, '0.0.0.0', () => {
  console.log(`${useHttps ? 'HTTPS' : 'HTTP'} server listening on :${port}`);
});
