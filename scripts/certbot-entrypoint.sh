#!/bin/sh
# Arranque del contenedor: emite certificado (webroot) si aún no existe en
# /etc/letsencrypt/live/$DOMAIN y copia PEM a /etc/nginx/ssl/.
# Requiere nginx en el host en :80 y :443 con /.well-known/acme-challenge/ → webroot.
#
# Si certonly falla, NO se reintenta en bucle (evita rate limits de Let's Encrypt).
# CERTBOT_STAGING=1 usa el entorno de pruebas de LE (sin contar para el límite de prod).
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

STAGING_ARGS=""
if [ "${CERTBOT_STAGING:-0}" = "1" ] || [ "${CERTBOT_STAGING:-}" = "true" ]; then
  STAGING_ARGS="--staging"
  echo "certbot-entrypoint: usando entorno STAGING de Let's Encrypt (pruebas)."
fi

copy_to_nginx() {
  cp "$LIVE/fullchain.pem" /etc/nginx/ssl/fullchain.pem
  cp "$LIVE/privkey.pem" /etc/nginx/ssl/privkey.pem
  chmod 644 /etc/nginx/ssl/fullchain.pem
  chmod 600 /etc/nginx/ssl/privkey.pem
  echo "certbot-entrypoint: certificados copiados a /etc/nginx/ssl/"
}

if [ ! -f "$LIVE/fullchain.pem" ]; then
  echo "certbot-entrypoint: sin certificado en $LIVE, ejecutando certonly (webroot)..."
  if ! certbot certonly --webroot -w "$WEBROOT" \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    $STAGING_ARGS; then
    echo "" >&2
    echo "certbot-entrypoint: certonly falló. Este contenedor NO volverá a intentarlo solo (evita el límite de 5 fallos/hora de Let's Encrypt)." >&2
    echo "certbot-entrypoint: 1) Para pruebas sin límite de prod: CERTBOT_STAGING=1 en compose. 2) Corrige nginx/webroot. 3) Espera el 'retry after' si estás rate-limited. 4) Luego: docker compose run --rm certbot certonly ..." >&2
    exec sleep infinity
  fi
else
  echo "certbot-entrypoint: certificado ya presente, omitiendo certonly."
fi

copy_to_nginx

echo "certbot-entrypoint: en el host, recarga nginx si aplica: sudo systemctl reload nginx"

exec sleep infinity
