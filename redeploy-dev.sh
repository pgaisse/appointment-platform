#!/bin/bash
set -e

BRANCH="dev"
COMPOSE_FILE="infra/docker/compose.dev.yml"
BUILD_TIME=$(date +%s)

echo "=============================="
echo " 🔄 1. Cambiando a rama $BRANCH..."
echo "=============================="
git fetch origin $BRANCH
git checkout $BRANCH
git pull origin $BRANCH

echo "=============================="
echo " 🔒 2. Verificando certificados SSL..."
echo "=============================="

# Certificados requeridos
DOMAINS=("dev.letsmarter.com" "api.dev.letsmarter.com")

for DOMAIN in "${DOMAINS[@]}"; do
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🚨 No existe certificado para $DOMAIN, generando..."
    docker compose -f $COMPOSE_FILE run --rm certbot_dev certonly --webroot \
      --webroot-path=/var/www/certbot \
      -d $DOMAIN \
      --email tu-correo@dominio.com --agree-tos --no-eff-email
  else
    echo "✅ Certificado para $DOMAIN ya existe, intentando renovar..."
    docker compose -f $COMPOSE_FILE run --rm certbot_dev renew
  fi
done

echo "=============================="
echo " 🛑 3. Deteniendo servicios..."
echo "=============================="
docker compose -f $COMPOSE_FILE down --remove-orphans

echo "=============================="
echo " 🔨 4. Rebuild desde cero..."
echo "=============================="
docker compose -f $COMPOSE_FILE build --no-cache --build-arg BUILD_TIME=$BUILD_TIME

echo "=============================="
echo " 🚀 5. Levantando entorno DEV en HTTPS..."
echo "=============================="
docker compose -f $COMPOSE_FILE up -d

echo "=============================="
echo " 🔄 6. Reiniciando Nginx para cargar certificados..."
echo "=============================="
docker compose -f $COMPOSE_FILE restart nginx_dev

echo "=============================="
echo " 📜 7. Logs en vivo..."
echo "=============================="
docker compose -f $COMPOSE_FILE logs -f
