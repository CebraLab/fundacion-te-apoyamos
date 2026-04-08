#!/usr/bin/env bash
# Emisión manual (modo webroot). Si usas `docker compose up` del certbot, el
# entrypoint ya emite en el primer arranque; este script es redundante salvo
# que quieras forzar certonly otra vez.
#
# Uso: ./scripts/certbot-issue-webroot.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="$REPO_ROOT/docker-compose-certbot.yml"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.certbot}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

DOMAIN="${DOMAIN:-inths.fundacionteapoyamos.cl}"
EMAIL="${EMAIL:-admin@fundacionteapoyamos.cl}"

if [ -z "${DOMAIN:-}" ] || [ -z "${EMAIL:-}" ]; then
  echo "Define DOMAIN y EMAIL en $ENV_FILE o exporta las variables." >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
else
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
fi

"${COMPOSE[@]}" run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

"${COMPOSE[@]}" run --rm \
  --entrypoint /bin/sh certbot \
  -c "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/privkey.pem && chmod 644 /etc/nginx/ssl/fullchain.pem && chmod 600 /etc/nginx/ssl/privkey.pem"

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
  sudo systemctl reload nginx
elif command -v nginx >/dev/null 2>&1; then
  sudo nginx -s reload
fi

echo "Certificado emitido y copiado a /etc/nginx/ssl/. Recarga nginx si aún no se hizo."
