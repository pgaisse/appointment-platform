#!/bin/bash
set -e

mongosh <<EOF
use $MONGO_DB
db.createUser({
  user: "${MONGO_USER:-appuser}",
  pwd: "${MONGO_PASS:-apppass}",
  roles: [ { role: "readWrite", db: "${MONGO_DB:-appointment}" } ]
})
EOF
