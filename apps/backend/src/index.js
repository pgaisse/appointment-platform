// apps/backend/index.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const qs = require('qs');

const Routes = require('./routes/index');
const SMS = require('./routes/sms');
const Topics = require('./routes/topics.routes');
const SocketRoutes = require('./routes/socket');
const mongoConnect = require('./config/db');
const setupSocket = require('./config/setupSocket');

const app = express();
const port = process.env.PORT || 3003;

// middlewares base
app.enable('trust proxy');
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('query parser', (str) => qs.parse(str));

// healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev', time: new Date().toISOString() });
});

// server + socket
const server = http.createServer(app);
const io = setupSocket(server);
app.use((req, _res, next) => { req.io = io; next(); });

// rutas (solo montarlas; que NO ejecuten queries top-level al importar)
app.use('/api', SMS);
app.use('/api', require('./routes/secure'));
app.use('/api', require('./routes/auth0-sync'));
app.use('/api', require('./routes/debug-auth'));
app.use('/api', Routes);
app.use('/api', Topics);
app.use('/api/socket.io', SocketRoutes);

// manejador de errores (después de rutas)
app.use((err, _req, res, next) => {
  if (err && err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'unauthorized', code: err.code, message: err.message, inner: err.inner?.message });
  }
  next(err);
});

// ARRANQUE: **espera** Mongo antes de escuchar
(async () => {
  await mongoConnect(); // 👈 evita "buffering timed out"
  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on :${port}`);
  });
})();
