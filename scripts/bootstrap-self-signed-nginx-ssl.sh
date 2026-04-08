#!/usr/bin/env bash
# Genera un certificado autofirmado temporal en /etc/nginx/ssl para poder
# arrancar nginx con el bloque listen 443 antes de tener Let's Encrypt.
# Sustituye DOMAIN por el mismo FQDN que usarás con Let's Encrypt.
#
# Uso directo:
#   sudo DOMAIN=inths.fundacionteapoyamos.cl ./scripts/bootstrap-self-signed-nginx-ssl.sh
# O el flujo completo (opción A): sudo ./scripts/setup-ssl-path-a.sh

set -euo pipefail
DOMAIN="${DOMAIN:-inths.fundacionteapoyamos.cl}"
SSL_DIR="${NGINX_SSL_DIR:-/etc/nginx/ssl}"

if [ "$(id -u)" -eq 0 ]; then
  mkdir -p "$SSL_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN"
  chmod 644 "$SSL_DIR/fullchain.pem"
  chmod 600 "$SSL_DIR/privkey.pem"
else
  sudo mkdir -p "$SSL_DIR"
  sudo openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/CN=$DOMAIN"
  sudo chmod 644 "$SSL_DIR/fullchain.pem"
  sudo chmod 600 "$SSL_DIR/privkey.pem"
fi
echo "Certificado temporal en $SSL_DIR (reemplazar con Let's Encrypt)."
