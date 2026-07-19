#!/usr/bin/env bash
# JobsMatchNow demo launcher — one entry point for every demo mode.
#
#   ./startdemo.sh                  interactive menu
#   ./startdemo.sh desktop          local web demo (API + Vite, http://localhost:3000)
#   ./startdemo.sh mobile           Expo QR demo against LOCAL servers (phone + computer on same Wi-Fi)
#   ./startdemo.sh mobile-prod      Expo QR demo wrapping the LIVE site (https://jobsmatchnow.com/app/)
#   ./startdemo.sh prod             check + open the real production site
#   TUNNEL=1 ./startdemo.sh mobile  use an Expo tunnel when LAN discovery is blocked
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PROD_SITE="https://jobsmatchnow.com"
banner() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

need_node_modules() {
  [ -d node_modules ] || { banner "installing root dependencies"; npm install; }
  [ -d mobile-expo/node_modules ] || { banner "installing mobile-expo dependencies"; (cd mobile-expo && npm install); }
}

check_prod() {
  banner "production health — $PROD_SITE"
  local ok=1
  for u in "$PROD_SITE" "$PROD_SITE/app/" "$PROD_SITE/api/health"; do
    local code
    code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$u" 2>/dev/null)
    printf '  %-40s HTTP %s\n' "$u" "${code:-timeout}"
    [ "$code" = 200 ] || ok=0
  done
  curl -s -m 15 "$PROD_SITE/api/health" | head -c 120; echo
  if [ "$ok" = 1 ]; then echo "  PRODUCTION UP"; else echo "  ⚠ production degraded — check EC2 13.229.182.186 (nginx / jobsmatchnow-api service)"; fi
  return 0
}

open_browser() {
  # Works from WSL (Windows browser) and plain Linux
  if command -v wslview >/dev/null 2>&1; then wslview "$1" >/dev/null 2>&1 &
  elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$1" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  else echo "open manually: $1"; fi
}

mode="${1:-}"
if [ -z "$mode" ]; then
  cat <<'MENU'

  JobsMatchNow demo launcher
  ──────────────────────────
  1) desktop      local web demo (API + Vite on http://localhost:3000)
  2) mobile       Expo QR demo — local servers (phone on same Wi-Fi)
  3) mobile-prod  Expo QR demo — wraps the LIVE production app
  4) prod         check + open the real production site

MENU
  read -rp "  choose [1-4]: " pick
  case "$pick" in
    1) mode=desktop ;; 2) mode=mobile ;; 3) mode=mobile-prod ;; 4) mode=prod ;;
    *) echo "unknown choice"; exit 2 ;;
  esac
fi

case "$mode" in
  desktop)
    need_node_modules
    # pinned ports: 3001 (API) + 3005 (web, strict) — avoids the Windows portproxy that squats on 3000
    banner "local desktop demo — API :3001 + web http://localhost:3005 (Ctrl+C stops both)"
    trap 'kill 0 2>/dev/null' INT TERM EXIT
    PORT=3001 node server/index.js &
    open_browser "http://localhost:3005"
    node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3005 --strictPort
    ;;

  mobile)
    need_node_modules
    banner "Expo QR demo against local servers"
    echo "  1. Install 'Expo Go' on your phone (App Store / Play Store)"
    echo "  2. Phone and this computer must be on the SAME Wi-Fi"
    echo "  3. Scan the QR below (Android: inside Expo Go · iPhone: Camera app)"
    if [ "${TUNNEL:-0}" = 1 ]; then
      banner "tunnel mode (LAN blocked)"
      ( node server/index.js & echo $! > /tmp/jmn_api.pid )
      ( node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 4173 --strictPort & echo $! > /tmp/jmn_web.pid )
      cd mobile-expo
      EXPO_PUBLIC_APP_URL="http://localhost:4173" exec npm run start:tunnel
    fi
    exec npm run expo:mobile
    ;;

  mobile-prod)
    need_node_modules
    check_prod
    banner "Expo QR demo wrapping the LIVE production app"
    echo "  Scan the QR with Expo Go — the app loads $PROD_SITE/app/"
    cd mobile-expo
    if [ "${TUNNEL:-0}" = 1 ]; then
      EXPO_PUBLIC_APP_URL="$PROD_SITE/app/" exec npm run start:tunnel
    fi
    EXPO_PUBLIC_APP_URL="$PROD_SITE/app/" exec npm run start
    ;;

  prod)
    check_prod
    banner "opening production site"
    open_browser "$PROD_SITE"
    open_browser "$PROD_SITE/app/"
    echo "  website : $PROD_SITE"
    echo "  web app : $PROD_SITE/app/"
    echo "  API     : $PROD_SITE/api/health"
    echo "  APK     : $PROD_SITE/downloads/JobsMatchNow-android-debug.apk"
    ;;

  *)
    echo "usage: $0 [desktop|mobile|mobile-prod|prod]"; exit 2 ;;
esac
