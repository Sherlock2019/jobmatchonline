#!/usr/bin/env bash
# Syncs deploy/jobsmatchnow.com.nginx to the live nginx site config on the
# production EC2 host, backing up the previous version first, then tests
# and reloads nginx. Run this whenever deploy/jobsmatchnow.com.nginx changes
# -- deploy-production.sh only ships the built web app, not this file.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=ubuntu@100.53.177.235
STAMP=$(date +%Y%m%d%H%M%S)

echo "== ship config"
scp -o BatchMode=yes "$ROOT/deploy/jobsmatchnow.com.nginx" "$H:/tmp/jobsmatchnow.com.new"

echo "== activate on server"
ssh -o BatchMode=yes "$H" "set -e
  sudo cp /etc/nginx/sites-available/jobsmatchnow.com /etc/nginx/sites-available/jobsmatchnow.com.bak-$STAMP
  sudo cp /tmp/jobsmatchnow.com.new /etc/nginx/sites-available/jobsmatchnow.com
  sudo nginx -t
  sudo systemctl reload nginx
  rm -f /tmp/jobsmatchnow.com.new
  echo 'nginx config activated and reloaded'"

echo "== verify header"
sleep 1
curl -sI https://jobsmatchnow.com | grep -i permissions-policy || echo "  (no Permissions-Policy header found)"
