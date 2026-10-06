#!/usr/bin/env bash
# Turn THIS machine into the jobsmatchnow.com production host. Run ON the server,
# from a checkout of the repo:   ./deploy/bootstrap-server.sh
#   nginx (web) + API (systemd) + local PostgreSQL + Let's Encrypt cert + daily crons.
# Idempotent — re-run it after a `git pull` to ship a new web + API release.
# Needs: Node >= 22, inbound TCP 80 + 443 open, DNS A record for $DOMAIN -> this host.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DOMAIN=jobsmatchnow.com
DOCROOT=/var/www/jobmatchsnow.work
ENVF=/etc/jobsmatchnow-api.env
STAMP=$(date +%Y%m%d%H%M%S)
REL=/opt/jobsmatchnow-api/releases/$STAMP

echo "== 1/8 packages =="
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node >= 22 required (found: $(node -v 2>/dev/null || echo none))"; exit 1; }
[ -x /usr/bin/node ] || sudo ln -sf "$(command -v node)" /usr/bin/node   # the systemd unit runs /usr/bin/node
sudo apt-get update -qq
sudo apt-get install -y -qq nginx postgresql certbot python3-certbot-nginx curl
sudo systemctl enable --now nginx postgresql

echo "== 2/8 PostgreSQL + API env file =="
PW=$(sudo grep -oP '(?<=DATABASE_URL=postgresql://jobsmatch:)[^@]+' $ENVF 2>/dev/null || true)
[ -n "$PW" ] || PW=$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 20)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='jobsmatch'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER jobsmatch PASSWORD '$PW'" >/dev/null
sudo -u postgres psql -c "ALTER USER jobsmatch PASSWORD '$PW'" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='jobsmatchnow'" | grep -q 1 \
  || sudo -u postgres createdb -O jobsmatch jobsmatchnow
sudo touch $ENVF && sudo chmod 600 $ENVF
secret() { head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40; }
setenv() { sudo grep -q "^$1=" $ENVF || echo "$1=$2" | sudo tee -a $ENVF >/dev/null; }
setenv DATABASE_URL "postgresql://jobsmatch:$PW@localhost:5432/jobsmatchnow"
setenv SESSION_SECRET "$(secret)"
setenv DEMO_AUTH true
setenv UPLOADS_DIR /var/lib/jobsmatchnow/uploads
setenv APP_PATH /app/
setenv BILLING_CRON_SECRET "$(secret)"
setenv ADMIN_PROMOTE_SECRET "$(secret)"
setenv VNPAY_RETURN_URL "https://$DOMAIN/api/billing/vnpay/return"
setenv WEB_APP_URL "https://$DOMAIN"
sudo mkdir -p /var/lib/jobsmatchnow/uploads/resumes /var/lib/jobsmatchnow/uploads/payment-proofs
sudo chown -R www-data:www-data /var/lib/jobsmatchnow

echo "== 3/8 API release $STAMP =="
sudo mkdir -p "$REL/server"
sudo tar -C "$ROOT/server" --exclude=node_modules -cf - . | sudo tar -C "$REL/server" -xf -
(cd "$REL/server" && sudo npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1)
sudo chown -R www-data:www-data "$REL"
sudo ln -sfn "$REL" /opt/jobsmatchnow-api/current
sudo cp "$ROOT/deploy/jobsmatchnow-api.service" /etc/systemd/system/jobsmatchnow-api.service
sudo systemctl daemon-reload
sudo systemctl enable jobsmatchnow-api >/dev/null 2>&1
sudo systemctl restart jobsmatchnow-api
sleep 3
systemctl is-active jobsmatchnow-api
curl -s -m 10 http://127.0.0.1:4174/api/health; echo
ls -dt /opt/jobsmatchnow-api/releases/* | tail -n +6 | xargs -r sudo rm -rf

echo "== 4/8 build web app =="
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build >/dev/null

echo "== 5/8 web release $STAMP =="
sudo mkdir -p "$DOCROOT/releases/$STAMP/downloads"
sudo cp -r dist/. "$DOCROOT/releases/$STAMP/"
sudo cp releases/JobsMatchNow-android-debug.apk "$DOCROOT/releases/$STAMP/downloads/" 2>/dev/null \
  || echo "   (no APK in releases/ — /downloads link will 404 until one is copied in)"
sudo chown -R www-data:www-data "$DOCROOT/releases/$STAMP"
sudo ln -sfn "$DOCROOT/releases/$STAMP" "$DOCROOT/current"
ls -dt $DOCROOT/releases/* | tail -n +6 | xargs -r sudo rm -rf

echo "== 6/8 TLS certificate =="
if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
  MYIP=$(curl -s -m 10 https://checkip.amazonaws.com | tr -d '[:space:]')
  DNSIP=$(getent ahostsv4 $DOMAIN | awk 'NR==1{print $1}')
  [ "$MYIP" = "$DNSIP" ] || { echo "DNS for $DOMAIN is $DNSIP but this host is $MYIP — fix the A record (or wait for it to propagate) and re-run"; exit 1; }
  DOMS="-d $DOMAIN"
  [ "$(getent ahostsv4 www.$DOMAIN | awk 'NR==1{print $1}')" = "$MYIP" ] && DOMS="$DOMS -d www.$DOMAIN"
  if [ -n "${CERTBOT_EMAIL:-}" ]; then MAIL="-m $CERTBOT_EMAIL"; else MAIL="--register-unsafely-without-email"; fi
  sudo certbot certonly --nginx --non-interactive --agree-tos $MAIL $DOMS
fi
# the site config includes these two; certbot's nginx plugin normally drops them in
[ -f /etc/letsencrypt/options-ssl-nginx.conf ] || sudo cp "$(dpkg -L python3-certbot-nginx | grep 'options-ssl-nginx.conf$' | head -1)" /etc/letsencrypt/options-ssl-nginx.conf
[ -f /etc/letsencrypt/ssl-dhparams.pem ] || sudo cp "$(dpkg -L python3-certbot | grep 'ssl-dhparams.pem$' | head -1)" /etc/letsencrypt/ssl-dhparams.pem

echo "== 7/8 nginx site =="
sudo cp "$ROOT/deploy/jobsmatchnow.com.nginx" /etc/nginx/sites-available/$DOMAIN
sudo ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
sudo nginx -t
sudo systemctl reload nginx

echo "== 8/8 daily crons (pg_dump keep 7, billing) =="
sudo tee /etc/cron.daily/jobsmatchnow-pgdump >/dev/null <<'EOF'
#!/bin/sh
mkdir -p /var/backups/jobsmatchnow
sudo -u postgres pg_dump jobsmatchnow | gzip > /var/backups/jobsmatchnow/db-$(date +%Y%m%d).sql.gz
ls -t /var/backups/jobsmatchnow/db-*.sql.gz | tail -n +8 | xargs -r rm -f
EOF
sudo tee /etc/cron.daily/jobsmatchnow-billing >/dev/null <<'EOF'
#!/bin/sh
BILLING_CRON_SECRET=$(grep '^BILLING_CRON_SECRET=' /etc/jobsmatchnow-api.env | cut -d= -f2-) \
  node /opt/jobsmatchnow-api/current/server/jobs/billing-daily.js >> /var/log/jobsmatchnow-billing.log 2>&1
EOF
sudo chmod +x /etc/cron.daily/jobsmatchnow-pgdump /etc/cron.daily/jobsmatchnow-billing

echo "== verify live =="
sleep 2
for u in "https://$DOMAIN" "https://$DOMAIN/app/" "https://$DOMAIN/api/health"; do
  printf '   %-42s HTTP %s\n' "$u" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u")"
done
echo "BOOTSTRAP COMPLETE: release $STAMP"
