#!/usr/bin/env bash
# Deploy jobsmatchnow.com to EC2 13.229.182.186 as an atomic release.
# Assembles: web app at / (root) + APK at /downloads/
# Usage: ./deploy/deploy-production.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
H=ubuntu@13.229.182.186
DOCROOT=/var/www/jobmatchsnow.work
STAMP=$(date +%Y%m%d%H%M%S)
STAGE=/tmp/jobsmatchnow-release-$STAMP

echo "== 1/4 build web app"
npm run build >/dev/null

echo "== 2/4 assemble release in $STAGE"
rm -rf "$STAGE"; mkdir -p "$STAGE/downloads"
cp -r dist/. "$STAGE/"
cp releases/JobsMatchNow-android-debug.apk "$STAGE/downloads/" 2>/dev/null || true

echo "== 3/4 rsync to server"
rsync -az --delete -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$STAGE/" "$H:/tmp/jobsmatchnow-incoming-$STAMP/"

echo "== activate release atomically"
ssh -o BatchMode=yes "$H" "set -e
  sudo mkdir -p $DOCROOT/releases/$STAMP
  sudo cp -r /tmp/jobsmatchnow-incoming-$STAMP/. $DOCROOT/releases/$STAMP/
  sudo chown -R www-data:www-data $DOCROOT/releases/$STAMP
  sudo ln -sfn $DOCROOT/releases/$STAMP $DOCROOT/current
  sudo nginx -t
  sudo systemctl reload nginx
  rm -rf /tmp/jobsmatchnow-incoming-$STAMP
  ls -dt $DOCROOT/releases/* | tail -n +6 | xargs -r sudo rm -rf   # keep last 5 releases
  echo activated: \$(readlink -f $DOCROOT/current)"

echo "== 4/4 verify live"
sleep 2
for u in "https://jobsmatchnow.com" "https://jobsmatchnow.com/api/health"; do
  printf '   %-42s HTTP %s\n' "$u" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u")"
done
curl -s -m 15 https://jobsmatchnow.com | grep -o "chase you\|hero-phone.png" | head -2 \
  && echo "   HERO LIVE" || { echo "   ⚠ hero copy/mockup not found on live page"; exit 1; }
rm -rf "$STAGE"
echo "DEPLOY COMPLETE: release $STAMP"
