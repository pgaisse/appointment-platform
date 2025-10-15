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

const { connectDB, initIndexes, getSessionIfAvailable, supportsTransactions }=require('./config/db');
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
app.use((err, req, res, next) => {
  if (err?.code === 'RBAC_DENY' || err?.name === 'ForbiddenError') {
    const required = err.required || [];
    res.set('X-Required-Permissions', required.join(','));
    return res.status(403).json({
      error: 'forbidden',
      code: 'insufficient_permissions',
      message: "You don't have permission to perform this action.",
      required,
      anyOf: !!err.anyOf,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // If your JWT middleware throws on missing/invalid token:
  if (err?.name === 'UnauthorizedError') {
    res.set('WWW-Authenticate', 'Bearer realm="api", error="invalid_token"');
    return res.status(401).json({
      error: 'unauthorized',
      code: 'invalid_token',
      message: 'Invalid or missing access token.',
    });
  }

  next(err);
});
// rutas (solo montarlas; que NO ejecuten queries top-level al importar)


app.use('/api', SMS);
app.use('/api', require('./routes/secure'));
app.use('/api', require('./routes/auth0-sync'));
app.use('/api', require('./routes/debug-auth'));
app.use('/api', require('./routes/priority-list'));
app.use('/api', Routes);
app.use('/api', Topics);
app.use('/api/appointment-manager', require('./routes/appointment-manager'));
app.use('/api/socket.io', SocketRoutes);
app.use('/api/admin/auth0', require('./routes/admin-auth0'));
app.use('/api/profile', require('./routes/profile'));
app.use("/api/message-templates", require("./routes/message-templates"));
app.use('/api',  require('./routes/appointments-range'));
app.use('/api/priorities/meta',  require('./routes/categories-priorities-manager'));
app.use('/api/providers', require('./routes/providers'));
app.use('/api/validate', require('./routes/validate'));

// manejador de errores (después de rutas)
app.use((err, _req, res, next) => {
  if (err && err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'unauthorized', code: err.code, message: err.message, inner: err.inner?.message });
  }
  next(err);
});

// ARRANQUE: **espera** Mongo antes de escuchar
(async () => {
  await connectDB(); // 👈 evita "buffering timed out"
  await initIndexes(); // 2) asegura índices únicos
  server.listen(port, '0.0.0.0', () => {
    console.log(`HTTP server listening on :${port}`);
  });
})();
