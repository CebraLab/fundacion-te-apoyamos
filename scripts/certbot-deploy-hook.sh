#!/bin/sh
# Ejecutado por certbot tras renovación exitosa (dentro del contenedor).
# Variables: RENEWED_LINEAGE (ruta a .../live/<dominio>)
set -e
if [ -z "$RENEWED_LINEAGE" ]; then
  echo "certbot-deploy-hook: RENEWED_LINEAGE vacío" >&2
  exit 1
fi
cp "$RENEWED_LINEAGE/fullchain.pem" /etc/nginx/ssl/fullchain.pem
cp "$RENEWED_LINEAGE/privkey.pem" /etc/nginx/ssl/privkey.pem
chmod 644 /etc/nginx/ssl/fullchain.pem
chmod 600 /etc/nginx/ssl/privkey.pem
echo "certbot-deploy-hook: certificados copiados a /etc/nginx/ssl/"
