// db.js
const mongoose = require('mongoose');

const {
  MONGO_HOST = 'mongo',            // en Docker usa el nombre del servicio
  MONGO_PORT = '27017',
  MONGO_DB = 'productionDB',
  MONGO_USER,
  MONGO_PASS,
  MONGO_AUTH_SOURCE = 'admin',     // por defecto 'admin' para usuarios root
} = process.env;

// Construye credenciales de forma segura (y permite conexión sin auth si no hay user)
const creds = MONGO_USER
  ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS || '')}@`
  : '';

const MONGO_URI =
  `mongodb://${creds}${MONGO_HOST}:${MONGO_PORT}/${encodeURIComponent(MONGO_DB)}?authSource=${encodeURIComponent(MONGO_AUTH_SOURCE)}`;
console.log("MONGO_URI",MONGO_URI)
// Evita que Mongoose “oculte” problemas de conexión con buffers
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 10000);

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4, // fuerza IPv4 (Docker/WSL a veces resuelve IPv6 y falla)
      // maxPoolSize: 10, // opcional
    });

    // enmascara credenciales en el log
    const safeUri = MONGO_URI.replace(/\/\/.*@/, '//***:***@');
    console.log('✅ MongoDB connected:', safeUri);
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    throw err;
  }
}

// Observabilidad útil
mongoose.connection.on('error', (e) => console.error('🔴 Mongo error:', e));
mongoose.connection.on('disconnected', () => console.warn('🟠 Mongo disconnected'));

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = connectDB;
