#!/bin/bash
set -e

mongosh <<EOF
use ${MONGO_DB}

// Verificar si ya existe el usuario
if (!db.getUser("${MONGO_USER}")) {
  db.createUser({
    user: "${MONGO_USER}",
    pwd: "${MONGO_PASS}",
    roles: [
      { role: "readWrite", db: "${MONGO_DB}" }
    ]
  });
  print("✅ Usuario '${MONGO_USER}' creado en '${MONGO_DB}'");
} else {
  print("ℹ️ Usuario '${MONGO_USER}' ya existe en '${MONGO_DB}', no se recrea");
}
EOF
