#!/usr/bin/env bash
# CHEAP MVP TIER (~$10/mo total): everything on the single EC2 t3.micro.
#   web (nginx) + API (systemd) + LOCAL PostgreSQL (free, replaces JSON file) + daily pg_dump.
# Run from WSL. Idempotent. The production tier (CloudFront/ECS/RDS) is deploy/aws/10-30.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
H=ubuntu@13.229.182.186
SSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new $H"
STAMP=$(date +%Y%m%d%H%M%S)
REL=/opt/jobsmatchnow-api/releases/$STAMP

echo "== 1/7 local PostgreSQL on the EC2 (server + db + user) =="
$SSH "set -e
  dpkg -l postgresql >/dev/null 2>&1 || sudo apt-get install -y -qq postgresql
  sudo systemctl enable --now postgresql
  PW=\$(sudo grep -oP '(?<=DATABASE_URL=postgresql://jobsmatch:)[^@]+' /etc/jobsmatchnow-api.env 2>/dev/null || true)
  if [ -z \"\$PW\" ]; then PW=\$(head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 20); fi
  sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='jobsmatch'\" | grep -q 1 \
    || sudo -u postgres psql -c \"CREATE USER jobsmatch PASSWORD '\$PW'\"
  sudo -u postgres psql -c \"ALTER USER jobsmatch PASSWORD '\$PW'\" >/dev/null
  sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='jobsmatchnow'\" | grep -q 1 \
    || sudo -u postgres createdb -O jobsmatch jobsmatchnow
  grep -q '^DATABASE_URL=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo \"DATABASE_URL=postgresql://jobsmatch:\$PW@localhost:5432/jobsmatchnow\" | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  # Real auth needs a stable session secret; demo logins stay on for the showcase;
  # uploads live outside the release dir so resumes survive deploys.
  grep -q '^SESSION_SECRET=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo \"SESSION_SECRET=\$(head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40)\" | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  grep -q '^DEMO_AUTH=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo 'DEMO_AUTH=true' | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  grep -q '^UPLOADS_DIR=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo 'UPLOADS_DIR=/var/lib/jobsmatchnow/uploads' | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  grep -q '^APP_PATH=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo 'APP_PATH=/app/' | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  # Billing: cron-secret and admin-promotion-secret are auto-generated once;
  # bank/VietQR instructions and the first admin still need a human to set
  # them (see deploy/aws/00-cheap-mvp-ec2.sh comment below).
  grep -q '^BILLING_CRON_SECRET=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo \"BILLING_CRON_SECRET=\$(head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40)\" | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  grep -q '^ADMIN_PROMOTE_SECRET=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo \"ADMIN_PROMOTE_SECRET=\$(head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 40)\" | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  # VNPay (direct Visa/Mastercard/JCB card payment): the return URL is fixed
  # and safe to auto-set; VNPAY_TMN_CODE/VNPAY_HASH_SECRET come from a real
  # VNPay merchant account and must be added by hand once you have one —
  # isVnpayConfigured() stays false (card payment hidden on the billing page)
  # until both are set. RECRUITER_MONTHLY_PRICE_VND also needs a human to
  # keep it near the current USD 20 exchange rate.
  grep -q '^VNPAY_RETURN_URL=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo 'VNPAY_RETURN_URL=https://jobsmatchnow.com/api/billing/vnpay/return' | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  grep -q '^WEB_APP_URL=' /etc/jobsmatchnow-api.env 2>/dev/null \
    || echo 'WEB_APP_URL=https://jobsmatchnow.com' | sudo tee -a /etc/jobsmatchnow-api.env >/dev/null
  # Stripe (France-registered merchant) and PayPal: no auto-generated secrets
  # here — STRIPE_SECRET_KEY/STRIPE_PRICE_ID/STRIPE_WEBHOOK_SECRET and
  # PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET/PAYPAL_PLAN_ID/PAYPAL_WEBHOOK_ID
  # all come from those providers' own dashboards and must be added by hand.
  # isStripeConfigured()/isPaypalConfigured() stay false (buttons hidden on
  # the billing page) until each provider's full set is present.
  sudo mkdir -p /var/lib/jobsmatchnow/uploads/resumes /var/lib/jobsmatchnow/uploads/payment-proofs
  sudo chown -R www-data:www-data /var/lib/jobsmatchnow/uploads
  echo 'postgres ready'"

echo "== 2/7 ship new API release (with the PostgreSQL store) =="
rsync -az -e "ssh -o BatchMode=yes" --exclude node_modules "$ROOT/server/" "$H:/tmp/jmn-api-$STAMP/"
$SSH "set -e
  sudo mkdir -p $REL
  sudo cp -r /tmp/jmn-api-$STAMP $REL/server
  cd $REL/server && sudo npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1
  sudo chown -R www-data:www-data $REL
  rm -rf /tmp/jmn-api-$STAMP
  echo 'release staged: $REL'"

echo "== 3/7 migrate existing db.json into PostgreSQL (only if table empty) =="
$SSH "set -e
  cd $REL/server
  sudo -u www-data env \$(sudo grep '^DATABASE_URL=' /etc/jobsmatchnow-api.env) node --input-type=module - <<'EOF'
import pg from 'pg';
import fs from 'node:fs';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('CREATE TABLE IF NOT EXISTS app_state (id integer PRIMARY KEY CHECK (id = 1), doc jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
const { rowCount } = await pool.query('SELECT 1 FROM app_state WHERE id = 1');
if (rowCount === 0 && fs.existsSync('/var/lib/jobsmatchnow/db.json')) {
  const doc = fs.readFileSync('/var/lib/jobsmatchnow/db.json', 'utf8');
  await pool.query('INSERT INTO app_state (id, doc) VALUES (1, \$1)', [doc]);
  console.log('migrated existing db.json into postgres');
} else {
  console.log(rowCount ? 'postgres already has data - keeping it' : 'no db.json - seed will apply');
}
await pool.end();
EOF"

echo "== 4/7 activate release + restart =="
$SSH "set -e
  sudo ln -sfn $REL /opt/jobsmatchnow-api/current
  sudo systemctl restart jobsmatchnow-api
  sleep 3
  systemctl is-active jobsmatchnow-api
  curl -s http://127.0.0.1:4174/api/health
  echo
  ls -dt /opt/jobsmatchnow-api/releases/* | tail -n +6 | xargs -r sudo rm -rf"

echo "== 5/7 daily backup (pg_dump, keep 7) =="
$SSH "sudo tee /etc/cron.daily/jobsmatchnow-pgdump >/dev/null <<'EOF'
#!/bin/sh
mkdir -p /var/backups/jobsmatchnow
sudo -u postgres pg_dump jobsmatchnow | gzip > /var/backups/jobsmatchnow/db-\$(date +%Y%m%d).sql.gz
ls -t /var/backups/jobsmatchnow/db-*.sql.gz | tail -n +8 | xargs -r rm -f
EOF
  sudo chmod +x /etc/cron.daily/jobsmatchnow-pgdump
  sudo /etc/cron.daily/jobsmatchnow-pgdump && ls -la /var/backups/jobsmatchnow | tail -2"

echo "== 6/7 daily billing processing (trial/grace/expiry, credits, reminders, job expiry) =="
$SSH "sudo tee /etc/cron.daily/jobsmatchnow-billing >/dev/null <<'EOF'
#!/bin/sh
BILLING_CRON_SECRET=\$(sudo grep '^BILLING_CRON_SECRET=' /etc/jobsmatchnow-api.env | cut -d= -f2-) \
  node /opt/jobsmatchnow-api/current/server/jobs/billing-daily.js >> /var/log/jobsmatchnow-billing.log 2>&1
EOF
  sudo chmod +x /etc/cron.daily/jobsmatchnow-billing
  sudo /etc/cron.daily/jobsmatchnow-billing && tail -3 /var/log/jobsmatchnow-billing.log"

echo "== 7/7 verify through the public site =="
curl -s -m 15 https://jobsmatchnow.com/api/health; echo
curl -s -m 15 "https://jobsmatchnow.com/api/bootstrap?role=candidate" | head -c 120 || true; echo
echo "CHEAP_MVP_DONE release=$STAMP"
