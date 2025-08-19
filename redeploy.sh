#!/bin/bash
set -e

COMPOSE_FILE="infra/docker/compose.prod.yml"
BUILD_TIME=$(date +%s)

BRANCH="main"
COMPOSE_FILE="infra/docker/compose.prod.yml"
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


export NGINX_CONF_FILE="nginx.conf"

echo "=============================="
echo " 🛑 1. Deteniendo servicios..."
echo "=============================="
docker compose -f $COMPOSE_FILE down --remove-orphans   # <-- aquí ya no hay -v

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
