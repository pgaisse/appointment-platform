#!/bin/bash
set -e

echo "🚀 Importando data inicial en $MONGO_INITDB_DATABASE con usuario $MONGO_USER..."

# Ejemplo: semilla de datos
mongosh "mongodb://$MONGO_USER:$MONGO_PASS@localhost:27017/$MONGO_INITDB_DATABASE?authSource=$MONGO_INITDB_DATABASE" \
  --eval 'db.sample.insertMany([{name:"User One"},{name:"User Two"}])'

# Ejemplo con mongorestore (si tienes dump)
# mongorestore --username $MONGO_USER --password $MONGO_PASS --authenticationDatabase $MONGO_INITDB_DATABASE /data/import
