#!/bin/bash
set -e

BRANCH="dev"
COMPOSE_FILE="infra/docker/compose.dev.yml"
PROJECT_NAME="appointment-dev"
BUILD_TIME=$(date +%s)

# Limpieza de contenedor huérfano de certbot_dev
if docker ps -a --format '{{.Names}}' | grep -Eq '^certbot_dev$'; then
  echo "🗑️ Eliminando contenedor viejo certbot_dev..."
  docker rm -f certbot_dev || true
fi

echo "=============================="
echo " 🔄 1. Cambiando a rama $BRANCH..."
echo "=============================="
git fetch origin $BRANCH
git checkout $BRANCH
git pull origin $BRANCH

echo "=============================="
echo " 🔒 2. Verificando certificados SSL..."
echo "=============================="
export NGINX_CONF_FILE="nginx.dev.conf"

DOMAIN="dev.letsmarter.com"

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "🚨 No existe certificado para $DOMAIN, generando..."
  docker compose -f $COMPOSE_FILE -p $PROJECT_NAME run --rm certbot_dev certonly --webroot \
    --webroot-path=/var/www/certbot \
    -d $DOMAIN \
    --email p.gaisse@gmail.com --agree-tos --no-eff-email
else
  echo "✅ Certificado para $DOMAIN ya existe, intentando renovar..."
  docker compose -f $COMPOSE_FILE -p $PROJECT_NAME run --rm certbot_dev renew
fi

echo "=============================="
echo " 🛑 3. Deteniendo servicios (y limpiando huérfanos)..."
echo "=============================="
docker compose -f $COMPOSE_FILE -p $PROJECT_NAME down --remove-orphans || true

echo "=============================="
echo " 🔨 4. Rebuild desde cero..."
echo "=============================="
docker compose -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache --build-arg BUILD_TIME=$BUILD_TIME

echo "=============================="
echo " 🚀 5. Levantando entorno DEV en HTTPS..."
echo "=============================="
docker compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d

echo "=============================="
echo " 🔄 6. Reiniciando Nginx para cargar certificados..."
echo "=============================="
docker compose -f $COMPOSE_FILE -p $PROJECT_NAME restart nginx || true

echo "=============================="
echo " 📜 7. Logs en vivo..."
echo "=============================="
docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
