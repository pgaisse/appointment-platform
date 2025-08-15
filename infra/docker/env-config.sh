#!/bin/sh

cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  AUTH0_DOMAIN: "${AUTH0_DOMAIN}",
  AUTH0_CLIENT_ID: "${AUTH0_CLIENT_ID}",
  AUTH0_AUDIENCE: "${AUTH0_AUDIENCE}",
  BASE_URL: "${BASE_URL}"
};
EOF

exec "$@"
