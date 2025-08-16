#!/bin/bash
set -e

echo "Creating application user in Mongo..."

cat <<EOF > /docker-entrypoint-initdb.d/init-user.js
db = db.getSiblingDB("${MONGO_INITDB_DATABASE}");
db.createUser({
  user: "${APP_MONGO_USER}",
  pwd: "${APP_MONGO_PASSWORD}",
  roles: [{ role: "readWrite", db: "${MONGO_INITDB_DATABASE}" }]
});
EOF
