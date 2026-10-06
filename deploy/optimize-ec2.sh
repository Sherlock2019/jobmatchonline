#!/usr/bin/env bash
# One-time perf tuning pass for the t3.micro MVP box (2 vCPU / ~911MB RAM).
# Does NOT change instance size or the data model -- just fixes settings that
# were never tuned for this box's actual (small) footprint:
#   - Postgres: max_connections 100->20 (app pool caps at 5 anyway, so 100
#     reserved connection slots were wasting memory), shared_buffers bumped
#     to a sane ~20% of RAM, effective_cache_size corrected from a leftover
#     4GB default down to what this box can actually cache, work_mem raised
#     now that far fewer connections can exist at once.
#   - systemd: caps Node's V8 heap (NODE_OPTIONS) and sets a MemoryMax so a
#     runaway Node process gets restarted by systemd instead of the OOM
#     killer taking down Postgres or nginx alongside it.
# Run deploy/sync-nginx-config.sh separately for the gzip fix (nginx site
# config is already tracked + synced by that script).
set -euo pipefail
H=ubuntu@100.53.177.235

cat > /tmp/optimize-remote.sh <<'REMOTE'
set -e
echo "== before: postgres settings =="
sudo -u postgres psql -tc "SHOW max_connections;" -tc "SHOW shared_buffers;" -tc "SHOW effective_cache_size;" -tc "SHOW work_mem;"

echo "== tuning postgres =="
sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = '20';"
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '192MB';"
sudo -u postgres psql -c "ALTER SYSTEM SET effective_cache_size = '384MB';"
sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = '8MB';"
sudo -u postgres psql -c "ALTER SYSTEM SET maintenance_work_mem = '64MB';"
sudo systemctl restart postgresql
sleep 2
echo "== after: postgres settings =="
sudo -u postgres psql -tc "SHOW max_connections;" -tc "SHOW shared_buffers;" -tc "SHOW effective_cache_size;" -tc "SHOW work_mem;"

echo "== tuning systemd unit (Node heap cap + memory safety net) =="
sudo cp /etc/systemd/system/jobsmatchnow-api.service /etc/systemd/system/jobsmatchnow-api.service.bak-perf
if ! grep -q NODE_OPTIONS /etc/systemd/system/jobsmatchnow-api.service; then
  sudo sed -i '/Environment=ALLOWED_ORIGINS=/a Environment=NODE_OPTIONS=--max-old-space-size=384' /etc/systemd/system/jobsmatchnow-api.service
fi
if ! grep -q MemoryMax /etc/systemd/system/jobsmatchnow-api.service; then
  sudo sed -i '/^Restart=always/a MemoryMax=600M\nMemoryHigh=500M' /etc/systemd/system/jobsmatchnow-api.service
fi
sudo systemctl daemon-reload
sudo systemctl restart jobsmatchnow-api
sleep 3
systemctl is-active jobsmatchnow-api
curl -s http://127.0.0.1:4174/api/health; echo

echo "== disk / swap after tuning =="
free -h
df -h /
REMOTE

scp -o BatchMode=yes /tmp/optimize-remote.sh "$H:/tmp/optimize-remote.sh"
ssh -o BatchMode=yes "$H" bash /tmp/optimize-remote.sh
rm -f /tmp/optimize-remote.sh

echo "== verify live site still healthy =="
curl -s -m 15 https://jobsmatchnow.com/api/health; echo
curl -s -o /dev/null -m 15 -w "https://jobsmatchnow.com -> HTTP %{http_code}\n" https://jobsmatchnow.com
