#!/bin/bash
set -e  # Detener si hay error

echo "🧹 Deteniendo y eliminando contenedores..."
docker compose -f infra/docker/compose.prod.yml down --volumes --remove-orphans

echo "🗑 Eliminando imágenes..."
docker image prune -af

echo "📂 Eliminando volúmenes no usados..."
docker volume prune -f

echo "🧼 Eliminando redes no usadas..."
docker network prune -f

echo "✅ Limpieza completada."
exit 0
