#!/bin/bash
# PeerDeliver Development Startup Script
# Run from WSL: cd /mnt/c/Users/nilsw/peerdeliver && bash start-dev.sh
# Then start Expo separately from PowerShell (see instructions at the end)

cd /mnt/c/Users/nilsw/peerdeliver

echo ""
echo "=== PeerDeliver Dev Environment ==="
echo ""

# --- 1. Database ---
echo "[1/3] Database..."
if sudo docker start peerdeliver-db 2>/dev/null; then
  echo "  OK - container started"
else
  echo "  Creating container..."
  sudo docker-compose up -d 2>/dev/null || sudo docker compose up -d
fi
# Wait for postgres
for i in {1..10}; do
  if pg_isready -h localhost -p 5432 -q 2>/dev/null; then break; fi
  sleep 1
done
echo "  OK - PostgreSQL ready"

# --- 2. ngrok ---
echo "[2/3] ngrok tunnel..."
pkill -f "ngrok http" 2>/dev/null || true
sleep 1
ngrok http 3001 > /dev/null 2>&1 &
sleep 4
TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)
if [ -n "$TUNNEL_URL" ]; then
  echo "  OK - $TUNNEL_URL"
  # Update app.json with the tunnel URL
  python3 -c "
import json
with open('packages/app/app.json') as f:
    config = json.load(f)
config['expo']['extra']['apiUrl'] = '$TUNNEL_URL'
with open('packages/app/app.json', 'w') as f:
    json.dump(config, f, indent=2)
" && echo "  OK - app.json updated"
else
  echo "  WARN - tunnel may still be starting (check http://127.0.0.1:4040)"
fi

# --- 3. Server ---
echo "[3/3] Server..."
pkill -f "tsx watch" 2>/dev/null || true
sleep 1
npm run server > server.log 2>&1 &
sleep 3
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "  OK - running on port 3001"
else
  echo "  WARN - still starting (check: tail -f server.log)"
fi

echo ""
echo "==========================================="
echo "  Backend is running!"
echo "  API tunnel: $TUNNEL_URL"
echo "  Server log: tail -f server.log"
echo "  ngrok UI:   http://127.0.0.1:4040"
echo "==========================================="
echo ""
echo "Now open PowerShell on Windows and run:"
echo ""
echo '  cd C:\Users\nilsw\peerdeliver\packages\app'
echo '  & "C:\Program Files\nodejs\npx.cmd" expo start --clear'
echo ""
echo "Then scan the QR code with Expo Go."
echo ""
