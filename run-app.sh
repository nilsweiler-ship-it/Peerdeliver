#!/bin/bash
# Start a fresh Expo session reflecting the latest code.
# - auto-detects the Mac's current LAN IP and writes it into app.json
# - ensures the Postgres container + backend API are running
# - kills any stale Expo/Metro, then starts Expo in LAN mode (clean cache)
#
# Usage:  bash run-app.sh
# Then:   scan the QR with Expo Go (phone on the same Wi-Fi), or press i / w.

set -e
REPO="/Users/weilernils/Peerdeliver"
cd "$REPO"

# 1) Current LAN IP (try Wi-Fi en0, then en1, then the default route's interface)
IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[ -z "$IP" ] && IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  DEV="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
  [ -n "$DEV" ] && IP="$(ipconfig getifaddr "$DEV" 2>/dev/null || true)"
fi
if [ -z "$IP" ]; then echo "Could not detect a LAN IP. Are you on Wi-Fi?"; exit 1; fi
echo "==> LAN IP: $IP"

# 2) Point the app at this machine's API
python3 - "$IP" <<'PY'
import json, sys
ip = sys.argv[1]
p = "packages/app/app.json"
cfg = json.load(open(p))
cfg["expo"]["extra"]["apiUrl"] = f"http://{ip}:3001"
json.dump(cfg, open(p, "w"), indent=2)
open(p, "a").write("\n")
print("==> apiUrl set to", cfg["expo"]["extra"]["apiUrl"])
PY

# 3) Database
docker start peerdeliver-db >/dev/null 2>&1 || docker compose up -d >/dev/null 2>&1 || true
echo "==> Database up"

# 4) Backend API (start only if not already healthy)
if curl -s -m3 http://127.0.0.1:3001/health >/dev/null 2>&1; then
  echo "==> Backend already running"
else
  echo "==> Starting backend (log: /tmp/peerdeliver-server.log)"
  nohup npm run server >/tmp/peerdeliver-server.log 2>&1 &
  for i in $(seq 1 25); do
    curl -s -m2 http://127.0.0.1:3001/health >/dev/null 2>&1 && break
    sleep 1
  done
  curl -s -m3 http://127.0.0.1:3001/health >/dev/null 2>&1 \
    && echo "==> Backend up" \
    || { echo "Backend failed to start — see /tmp/peerdeliver-server.log"; exit 1; }
fi

# 5) Kill any stale Expo / Metro so we start clean
pkill -f "expo start" 2>/dev/null || true
pkill -f "expo/AppEntry" 2>/dev/null || true
sleep 1

# 6) Fresh Expo in LAN mode (foreground — this is your interactive Expo terminal)
echo "==> Starting Expo (LAN). Scan the QR with Expo Go on the same Wi-Fi."
cd packages/app
exec npx expo start --lan --clear
