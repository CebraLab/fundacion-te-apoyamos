#!/usr/bin/env bash
# Genera un certificado autofirmado temporal en /etc/nginx/ssl para poder
# arrancar nginx con el bloque listen 443 antes de tener Let's Encrypt.
# Sustituye DOMAIN por el mismo FQDN que usarás con Let's Encrypt.
#
# Uso:
#   sudo DOMAIN=inths.fundacionteapoyamos.cl ./scripts/bootstrap-self-signed-nginx-ssl.sh

set -euo pipefail
DOMAIN="${DOMAIN:-localhost}"
SSL_DIR="${NGINX_SSL_DIR:-/etc/nginx/ssl}"

sudo mkdir -p "$SSL_DIR"
sudo openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN"

sudo chmod 644 "$SSL_DIR/fullchain.pem"
sudo chmod 600 "$SSL_DIR/privkey.pem"
echo "Certificado temporal en $SSL_DIR (reemplazar con Let's Encrypt)."
