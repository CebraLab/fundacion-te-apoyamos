#!/usr/bin/env bash
# Primera emisión del certificado (modo webroot). Nginx debe estar en marcha
# escuchando :80 con location /.well-known/acme-challenge/ (ver nginx/queue_app).
#
# Uso: ./scripts/certbot-issue-webroot.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.certbot}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Falta $ENV_FILE (copia desde .env.certbot.example)" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [ -z "${DOMAIN:-}" ] || [ -z "${EMAIL:-}" ]; then
  echo "Define DOMAIN y EMAIL en $ENV_FILE" >&2
  exit 1
fi

cd "$REPO_ROOT"
docker compose --env-file "$ENV_FILE" -f docker-compose-certbot.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Copia inicial al directorio que usa nginx (entrypoint de la imagen es "certbot")
docker compose --env-file "$ENV_FILE" -f docker-compose-certbot.yml run --rm \
  --entrypoint /bin/sh certbot \
  -c "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/privkey.pem && chmod 644 /etc/nginx/ssl/fullchain.pem && chmod 600 /etc/nginx/ssl/privkey.pem"

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
  sudo systemctl reload nginx
elif command -v nginx >/dev/null 2>&1; then
  sudo nginx -s reload
fi

echo "Certificado emitido y copiado a NGINX_SSL_DIR. Recarga nginx si aún no se hizo."
