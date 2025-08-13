# Imagen ligera con envsubst disponible
FROM nginx:stable-alpine

# envsubst viene en gettext en Alpine
RUN apk add --no-cache gettext

# Copiamos plantilla y entrypoint
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY entrypoint.sh /entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]