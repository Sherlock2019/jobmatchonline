#!/usr/bin/env bash
# JobsMatchNow production launcher — run ON the production server.
#
#   ./startprod.sh           start production (first run sets the whole server up)
#   ./startprod.sh deploy    git pull + ship a new web + API release
#   ./startprod.sh status    service state + live health check
#   ./startprod.sh stop      stop the API and take the site offline
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PROD_SITE="https://jobsmatchnow.com"
SERVICES="postgresql jobsmatchnow-api nginx"
banner() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

installed() {
  [ -f /etc/systemd/system/jobsmatchnow-api.service ] && [ -f /etc/nginx/sites-available/jobsmatchnow.com ]
}

status() {
  banner "services"
  for s in $SERVICES; do printf '  %-20s %s\n' "$s" "$(systemctl is-active "$s" 2>/dev/null)"; done
  banner "production health — $PROD_SITE"
  local ok=1
  for u in "$PROD_SITE" "$PROD_SITE/app/" "$PROD_SITE/api/health"; do
    local code
    code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$u" 2>/dev/null)
    printf '  %-40s HTTP %s\n' "$u" "${code:-timeout}"
    [ "$code" = 200 ] || ok=0
  done
  if [ "$ok" = 1 ]; then echo "  PRODUCTION UP"; else echo "  ⚠ production degraded — sudo journalctl -u jobsmatchnow-api -n 50 · sudo nginx -t"; fi
  [ "$ok" = 1 ]
}

case "${1:-start}" in
  start)
    if ! installed; then
      banner "first run — setting up this server as production"
      ./deploy/bootstrap-server.sh || exit 1
    else
      banner "starting production services"
      sudo ln -sfn /etc/nginx/sites-available/jobsmatchnow.com /etc/nginx/sites-enabled/jobsmatchnow.com
      for s in $SERVICES; do sudo systemctl enable --now "$s" >/dev/null 2>&1; done
      sudo nginx -t && sudo systemctl reload nginx
      sleep 3
    fi
    status
    ;;

  deploy)
    banner "pulling latest code"
    git pull --ff-only || exit 1
    ./deploy/bootstrap-server.sh || exit 1
    status
    ;;

  status)
    status
    ;;

  stop)
    banner "stopping production (database keeps running)"
    sudo systemctl stop jobsmatchnow-api
    sudo rm -f /etc/nginx/sites-enabled/jobsmatchnow.com
    sudo nginx -t && sudo systemctl reload nginx
    echo "  stopped — ./startprod.sh brings it back"
    ;;

  *)
    echo "usage: $0 [start|deploy|status|stop]"; exit 2 ;;
esac
