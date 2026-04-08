#!/usr/bin/env bash
# Renovación + copia vía deploy-hook + recarga nginx en el host.
# Uso: ./scripts/certbot-renew.sh
# Cron (root): 0 3,15 * * * /ruta/al/repo/scripts/certbot-renew.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="$REPO_ROOT/docker-compose-certbot.yml"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.certbot}"

if [ -f "$ENV_FILE" ]; then
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
else
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
fi

"${COMPOSE[@]}" run --rm certbot renew \
  --deploy-hook "sh /certbot-deploy-hook.sh"

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
  sudo systemctl reload nginx
  echo "nginx recargado (systemctl reload nginx)."
elif command -v nginx >/dev/null 2>&1; then
  sudo nginx -s reload
  echo "nginx recargado (nginx -s reload)."
else
  echo "Aviso: no se pudo recargar nginx automáticamente; hazlo a mano tras renovar." >&2
fi
