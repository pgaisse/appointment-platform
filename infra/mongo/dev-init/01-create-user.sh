#!/bin/bash
set -e

echo "📌 Creando usuario $MONGO_APP_USER en $MONGO_INITDB_DATABASE ..."

mongosh <<EOF
use $MONGO_INITDB_DATABASE
db.createUser({
  user: "$MONGO_APP_USER",
  pwd: "$MONGO_APP_PASS",
  roles: [ { role: "readWrite", db: "$MONGO_INITDB_DATABASE" } ]
})
EOF
