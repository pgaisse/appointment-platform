#!/bin/bash
set -e

echo "🚀 Restaurando respaldo de MongoDB en productionDB..."

# Buscar la carpeta de respaldo más reciente
LATEST_BACKUP=$(ls -td /backup/* | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ No se encontraron respaldos en /backup"
  exit 0
fi

echo "📂 Último respaldo encontrado: $LATEST_BACKUP"

# Verificar si dentro hay otra carpeta con el nombre de la base
if [ -d "$LATEST_BACKUP/$MONGO_INITDB_DATABASE" ]; then
  RESTORE_PATH="$LATEST_BACKUP/$MONGO_INITDB_DATABASE"
else
  RESTORE_PATH="$LATEST_BACKUP"
fi

echo "📦 Restaurando desde: $RESTORE_PATH"

# Restaurar desde la carpeta correcta
mongorestore \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_INITDB_DATABASE" \
  --drop \
  "$RESTORE_PATH" || true

echo "✅ Restore finalizado desde $RESTORE_PATH"
