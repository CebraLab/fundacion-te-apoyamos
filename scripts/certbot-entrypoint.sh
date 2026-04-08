#!/bin/sh
# Arranque del contenedor: emite certificado (webroot) si aún no existe en
# /etc/letsencrypt/live/$DOMAIN y copia PEM a /etc/nginx/ssl/.
# Requiere nginx en el host en :80 con /.well-known/acme-challenge/ → /var/www/certbot.
#
# Si se pasan argumentos (p. ej. `docker compose run certbot renew ...`), se
# delega en el binario certbot sin ejecutar la lógica de arranque.
set -e

if [ "$#" -gt 0 ]; then
  exec certbot "$@"
fi

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "certbot-entrypoint: define DOMAIN y EMAIL en docker-compose-certbot.yml" >&2
  exit 1
fi
WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"
LIVE="/etc/letsencrypt/live/$DOMAIN"

copy_to_nginx() {
  cp "$LIVE/fullchain.pem" /etc/nginx/ssl/fullchain.pem
  cp "$LIVE/privkey.pem" /etc/nginx/ssl/privkey.pem
  chmod 644 /etc/nginx/ssl/fullchain.pem
  chmod 600 /etc/nginx/ssl/privkey.pem
  echo "certbot-entrypoint: certificados copiados a /etc/nginx/ssl/"
}

if [ ! -f "$LIVE/fullchain.pem" ]; then
  echo "certbot-entrypoint: sin certificado en $LIVE, ejecutando certonly (webroot)..."
  certbot certonly --webroot -w "$WEBROOT" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive
else
  echo "certbot-entrypoint: certificado ya presente, omitiendo certonly."
fi

copy_to_nginx

echo "certbot-entrypoint: en el host, recarga nginx si aplica: sudo systemctl reload nginx"

# Evita que el servicio termine y reinicie en bucle; el contenedor permanece en marcha.
exec sleep infinity
