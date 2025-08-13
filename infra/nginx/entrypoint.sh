#!/usr/bin/env sh
set -e

# Validaciones mínimas
if [ -z "$SERVER_NAME" ]; then
  echo "[ERROR] SERVER_NAME no está definido. Exporta SERVER_NAME o usa env_file" >&2
  exit 1
fi

# Sustituir variables de entorno en la plantilla
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Mostrar un resumen útil
echo "[nginx] SERVER_NAME=${SERVER_NAME}"

# Arrancar Nginx en primer plano
exec nginx -g 'daemon off;'