#!/bin/bash
set -e  # para que falle si algo falla

BACKUP_DIR="./mongo-backup"

echo "📦 Reorganizando backup..."
# Si existe la subcarpeta duplicada, mover contenido
if [ -d "$BACKUP_DIR/mongo-backup" ]; then
  mv "$BACKUP_DIR/mongo-backup/"* "$BACKUP_DIR/"
  rm -rf "$BACKUP_DIR/mongo-backup"
fi

echo "📂 Contenido del backup:"
ls -l "$BACKUP_DIR"

echo "🚀 Restaurando en MongoDB..."
mongorestore --uri="mongodb://pgaisse:Patoch-2202@localhost:27017/productionDB?authSource=productionDB" "$BACKUP_DIR/productionDB"

echo "✅ Restauración completada"
