#!/usr/bin/env bash
# Opción A (recomendada): directorios para ACME + certificado autofirmado temporal
# en /etc/nginx/ssl para que nginx arranque con queue_app (HTTP+HTTPS) antes de LE.
#
# Uso en el servidor (desde la raíz del repo):
#   sudo ./scripts/setup-ssl-path-a.sh
#
# Luego:
#   sudo nginx -t && sudo systemctl reload nginx
#   docker compose -f docker-compose-certbot.yml up -d

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${DOMAIN:-inths.fundacionteapoyamos.cl}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutar con sudo: sudo $0" >&2
  exit 1
fi

mkdir -p /var/www/certbot /etc/nginx/ssl
DOMAIN="$DOMAIN" "$REPO_ROOT/scripts/bootstrap-self-signed-nginx-ssl.sh"

echo ""
echo "Listo. Siguiente:"
echo "  1) Activar nginx/queue_app en sites-enabled, luego: nginx -t && systemctl reload nginx"
echo "  2) docker compose -f $REPO_ROOT/docker-compose-certbot.yml up -d"
