#!/bin/bash
set -e

COMPOSE_FILE="infra/docker/compose.prod.yml"
BUILD_TIME=$(date +%s)

# Si no se pasa parámetro → usa http
MODE=${1:-http}

if [ "$MODE" = "http" ]; then
  export NGINX_CONF_FILE="nginx.http.conf"
  echo "🌐 Modo HTTP activado"
else
  export NGINX_CONF_FILE="nginx.https.conf"
  echo "🔒 Modo HTTPS activado"
fi

echo "=============================="
echo " 🛑 1. Deteniendo servicios..."
echo "=============================="
docker compose -f $COMPOSE_FILE down -v --remove-orphans

echo "=============================="
echo " 🔨 2. Rebuild desde cero..."
echo "=============================="
docker compose -f $COMPOSE_FILE build --no-cache --build-arg BUILD_TIME=$BUILD_TIME

echo "=============================="
echo " 🚀 3. Levantando en $MODE ..."
echo "=============================="
docker compose -f $COMPOSE_FILE up -d

echo "=============================="
echo " 📜 4. Logs en vivo..."
echo "=============================="
docker compose -f $COMPOSE_FILE logs -f
