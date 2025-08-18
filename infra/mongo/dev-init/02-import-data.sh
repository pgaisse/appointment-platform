#!/bin/bash
set -e

echo "🚀 Importando data inicial en $MONGO_INITDB_DATABASE con usuario $MONGO_APP_USER..."

# Ejemplo: semilla de datos
mongosh "mongodb://$MONGO_APP_USER:$MONGO_APP_PASS@localhost:27017/$MONGO_INITDB_DATABASE?authSource=$MONGO_INITDB_DATABASE" \
  --eval 'db.sample.insertMany([{name:"User One"},{name:"User Two"}])'

# Ejemplo con mongorestore (si tienes dump)
# mongorestore --username $MONGO_APP_USER --password $MONGO_APP_PASS --authenticationDatabase $MONGO_INITDB_DATABASE /data/import
