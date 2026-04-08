#!/usr/bin/env bash
# Let's Encrypt (webroot) + copia a /etc/nginx/ssl/ para nginx del sistema.
#
# Dónde están los certificados:
#   - bootstrap: crea PEM temporales directamente en /etc/nginx/ssl/
#   - issue/renew: Certbot guarda en /etc/letsencrypt/live/$DOMAIN/; nginx usa /etc/nginx/ssl/
#     (issue y renew copian solos; si emitiste con certbot a mano, usa "copy").
#
# Uso (desde la raíz del repo, en el servidor):
#   sudo ./scripts/letsencrypt.sh bootstrap
#   sudo ./scripts/letsencrypt.sh issue
#   sudo ./scripts/letsencrypt.sh renew
#   sudo ./scripts/letsencrypt.sh copy    # solo copia LE → nginx + reload (sin certbot)
#
# Copia manual equivalente a "copy" (ajusta DOMAIN si cambia):
#   sudo cp /etc/letsencrypt/live/inths.fundacionteapoyamos.cl/fullchain.pem /etc/nginx/ssl/fullchain.pem
#   sudo cp /etc/letsencrypt/live/inths.fundacionteapoyamos.cl/privkey.pem /etc/nginx/ssl/privkey.pem
#   sudo chmod 644 /etc/nginx/ssl/fullchain.pem && sudo chmod 600 /etc/nginx/ssl/privkey.pem
#   sudo systemctl reload nginx
#
# Variables (opcional): DOMAIN, EMAIL, CERTBOT_STAGING=1 para pruebas (certs no confían en navegadores).

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$REPO_ROOT/.env.certbot" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$REPO_ROOT/.env.certbot"
  set +a
fi
COMPOSE=(docker compose -f "$REPO_ROOT/docker-compose-certbot.yml")

DOMAIN="${DOMAIN:-inths.fundacionteapoyamos.cl}"
EMAIL="${EMAIL:-admin@fundacionteapoyamos.cl}"
WEBROOT=/var/www/certbot
SSL_DIR=/etc/nginx/ssl
LIVE="/etc/letsencrypt/live/$DOMAIN"

STAGING_ARGS=()
if [ "${CERTBOT_STAGING:-0}" = "1" ] || [ "${CERTBOT_STAGING:-}" = "true" ]; then
  STAGING_ARGS=(--staging)
  echo "letsencrypt: modo STAGING (solo pruebas)."
fi

copy_le_to_nginx() {
  cp "$LIVE/fullchain.pem" "$SSL_DIR/fullchain.pem"
  cp "$LIVE/privkey.pem" "$SSL_DIR/privkey.pem"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
}

reload_nginx() {
  if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl reload nginx
  elif command -v nginx >/dev/null 2>&1; then
    nginx -s reload
  fi
}

cmd_bootstrap() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Ejecutar: sudo $0 bootstrap" >&2
    exit 1
  fi
  mkdir -p "$WEBROOT" "$SSL_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
  echo "PEM temporales en $SSL_DIR. Activa nginx/queue_app, luego: sudo $0 issue"
}

cmd_issue() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Ejecutar: sudo $0 issue" >&2
    exit 1
  fi
  cd "$REPO_ROOT"
  "${COMPOSE[@]}" run --rm certbot certonly --webroot -w "$WEBROOT" \
    -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive \
    "${STAGING_ARGS[@]}"
  copy_le_to_nginx
  reload_nginx
  echo "Certificado emitido y nginx recargado."
}

cmd_renew() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Ejecutar: sudo $0 renew" >&2
    exit 1
  fi
  cd "$REPO_ROOT"
  "${COMPOSE[@]}" run --rm certbot renew
  if [ -f "$LIVE/fullchain.pem" ]; then
    copy_le_to_nginx
    reload_nginx
  fi
  echo "Renovación aplicada (si hubo certificados renovados)."
}

cmd_copy() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Ejecutar: sudo $0 copy" >&2
    exit 1
  fi
  if [ ! -f "$LIVE/fullchain.pem" ] || [ ! -f "$LIVE/privkey.pem" ]; then
    echo "No hay certificados en $LIVE (ejecuta issue primero o revisa DOMAIN)." >&2
    exit 1
  fi
  mkdir -p "$SSL_DIR"
  copy_le_to_nginx
  reload_nginx
  echo "Copiado $LIVE → $SSL_DIR y nginx recargado."
}

case "${1:-}" in
  bootstrap) cmd_bootstrap ;;
  issue)     cmd_issue ;;
  renew)     cmd_renew ;;
  copy)      cmd_copy ;;
  *)
    echo "Uso: sudo $0 bootstrap|issue|renew|copy" >&2
    exit 1
    ;;
esac
