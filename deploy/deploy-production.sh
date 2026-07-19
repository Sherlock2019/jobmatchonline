#!/usr/bin/env bash
# Deploy jobsmatchnow.com to EC2 13.229.182.186 as an atomic release.
# Assembles: marketing site (prerendered) at / + web app at /app/ + APK at /downloads/
# Usage: ./deploy/deploy-production.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
H=ubuntu@13.229.182.186
DOCROOT=/var/www/jobmatchsnow.work
STAMP=$(date +%Y%m%d%H%M%S)
STAGE=/tmp/jobsmatchnow-release-$STAMP

echo "== 1/6 build marketing + web app"
(cd marketing && npm run build >/dev/null)
npm run build:web:production >/dev/null

echo "== 2/6 prerender marketing index.html from the built worker"
node - <<'EOF'
const { pathToFileURL } = require('node:url');
(async () => {
  const workerUrl = pathToFileURL(process.cwd() + '/marketing/dist/server/index.js');
  workerUrl.searchParams.set('deploy', String(Date.now()));
  const { default: worker } = await import(workerUrl.href);
  const res = await worker.fetch(new Request('http://localhost/', { headers: { accept: 'text/html' } }),
    { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} });
  if (res.status !== 200) throw new Error('prerender failed: HTTP ' + res.status);
  const html = await res.text();
  if (!/Let the right match choose you/.test(html)) throw new Error('prerender missing expected hero copy');
  require('node:fs').writeFileSync('marketing/dist/client/index.html', html);
  console.log('   prerendered index.html:', html.length, 'bytes');
})().catch((e) => { console.error(e); process.exit(1); });
EOF

echo "== 3/6 assemble release in $STAGE"
rm -rf "$STAGE"; mkdir -p "$STAGE/app" "$STAGE/downloads"
cp -r marketing/dist/client/. "$STAGE/"
cp public/sw.js "$STAGE/sw.js" 2>/dev/null || true
cp -r dist/. "$STAGE/app/"
cp releases/JobsMatchNow-android-debug.apk "$STAGE/downloads/" 2>/dev/null || true

echo "== 4/6 rsync to server"
rsync -az --delete -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$STAGE/" "$H:/tmp/jobsmatchnow-incoming-$STAMP/"

echo "== 5/6 activate release atomically"
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

echo "== 6/6 verify live"
sleep 2
for u in "https://jobsmatchnow.com" "https://jobsmatchnow.com/app/" "https://jobsmatchnow.com/api/health"; do
  printf '   %-42s HTTP %s\n' "$u" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u")"
done
curl -s -m 15 https://jobsmatchnow.com | grep -o "Let the right match choose you" | head -1 \
  && echo "   NEW PITCH LIVE" || { echo "   ⚠ new pitch not found on live page"; exit 1; }
rm -rf "$STAGE"
echo "DEPLOY COMPLETE: release $STAMP"
