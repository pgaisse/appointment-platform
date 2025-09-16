// db.js
const mongoose = require('mongoose');

const {
  MONGO_URI: MONGO_URI_ENV,
  MONGO_HOST = 'mongo',
  MONGO_PORT = '27017',
  MONGO_DB = 'productionDB',
  MONGO_USER,
  MONGO_PASS,
  MONGO_AUTH_SOURCE = 'admin',
  MONGO_RS,                          // ej: rs0 (setéalo si tienes replica set)
  MONGO_USE_TRANSACTIONS = 'false',  // 'true' para intentar usar transacciones
  MONGO_DIRECT_CONNECTION,           // 'true' fuerza standalone
  MONGO_SERVER_SELECTION_TIMEOUT_MS = '5000',
} = process.env;

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 10000);
// opcional: mongoose.set('strictQuery', true);

function buildUri() {
  if (MONGO_URI_ENV) return MONGO_URI_ENV; // permite URI completa por env

  const creds = MONGO_USER
    ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS || '')}@`
    : '';

  const params = new URLSearchParams();
  params.set('authSource', MONGO_AUTH_SOURCE);

  if (MONGO_RS) {
    params.set('replicaSet', MONGO_RS);
    params.set('retryWrites', 'true');
    params.set('w', 'majority');
    params.set('directConnection', 'false');
  } else if (MONGO_DIRECT_CONNECTION !== undefined) {
    params.set('directConnection', String(MONGO_DIRECT_CONNECTION) === 'true' ? 'true' : 'false');
  } else {
    // Standalone por defecto
    params.set('directConnection', 'true');
    params.set('retryWrites', 'false');
  }

  return `mongodb://${creds}${MONGO_HOST}:${MONGO_PORT}/${encodeURIComponent(MONGO_DB)}?${params.toString()}`;
}

function mask(uri) {
  return uri.replace(/\/\/([^@]*?)@/, '//***:***@');
}

let _supportsTransactions = false;

async function connectDB() {
  const uri = buildUri();
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      family: 4,
      // maxPoolSize: 10,
    });

    // Detectar replica set => soporte de transacciones
    try {
      const hello = await conn.connection.db.admin().command({ hello: 1 });
      const rsName = hello.setName || null;
      _supportsTransactions = Boolean(rsName);
      console.log(`✅ MongoDB connected: ${mask(uri)}  | RS: ${rsName || 'none'} | TX support: ${_supportsTransactions}`);
    } catch (e) {
      console.warn('⚠️ No se pudo verificar replica set (hello):', e?.message || e);
      console.log(`✅ MongoDB connected: ${mask(uri)}  | RS: unknown | TX support: ${_supportsTransactions}`);
    }

    if (String(MONGO_USE_TRANSACTIONS) === 'true' && !_supportsTransactions) {
      console.warn('⚠️ MONGO_USE_TRANSACTIONS=true pero no hay replica set. Las transacciones fallarán.');
    }

    return conn.connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    throw err;
  }
}

// Helpers para usar en tus servicios
async function getSessionIfAvailable() {
  if (String(MONGO_USE_TRANSACTIONS) === 'true' && _supportsTransactions) {
    return mongoose.startSession();
  }
  return null;
}

function supportsTransactions() {
  return _supportsTransactions;
}

// Observabilidad útil
mongoose.connection.on('error', (e) => console.error('🔴 Mongo error:', e));
mongoose.connection.on('disconnected', () => console.warn('🟠 Mongo disconnected'));

async function gracefulExit() {
  try {
    await mongoose.connection.close();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', gracefulExit);
process.on('SIGTERM', gracefulExit);

module.exports = {
  connectDB,
  getSessionIfAvailable,
  supportsTransactions,
};
