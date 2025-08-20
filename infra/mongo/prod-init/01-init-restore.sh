#!/bin/bash
set -e

echo "🚀 Restaurando respaldo de MongoDB en productionDB..."

mongorestore \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_INITDB_DATABASE" \
  /backup/productionDB || true

echo "✅ Restore finalizado"
