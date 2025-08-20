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

// -------- Rutas --------
app.use("/api",SMS);
app.use("/api",Routes);

// -------- Server + Socket.IO --------
let server;

if (useHttps) {
  const keyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/letsmarter.com/privkey.pem';
  const certPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/letsmarter.com/fullchain.pem';

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const creds = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
    server = https.createServer(creds, app);
    console.log('HTTPS: certificados encontrados, iniciando servidor TLS…');
  } else {
    console.warn('HTTPS habilitado pero certificados no encontrados. Cambiando a HTTP.');
    server = http.createServer(app);
  }
} else {
  // Desarrollo: HTTP simple
  server = http.createServer(app);
}

// Inyectar io en req
const io = setupSocket(server);
app.use((req, _res, next) => { req.io = io; next(); });

// Conexión DB
mongoConnect();

// Escuchar (un solo server!)
server.listen(port, '0.0.0.0', () => {
  console.log(`${useHttps ? 'HTTPS' : 'HTTP'} server listening on :${port}`);
});
