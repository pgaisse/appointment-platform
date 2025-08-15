#!/bin/sh
echo "🔧 Reemplazando variables de entorno en archivos estáticos..."

APP_DIR=/usr/share/nginx/html
VARS='VITE_AUTH0_AUDIENCE VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID VITE_BASE_URL'

for var in $VARS; do
  value=$(printenv $var)
  if [ -n "$value" ]; then
    echo " - $var -> $value"
    find $APP_DIR -type f \( -name "*.js" -o -name "*.html" \) \
      -exec sed -i "s|__${var}__|$value|g" {} +
  else
    echo "⚠️  Variable $var no está definida, se deja el placeholder."
  fi
done

echo "✅ Variables reemplazadas."
