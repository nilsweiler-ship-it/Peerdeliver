#!/bin/bash
# PeerDeliver Development Startup Script
# Run this in WSL: bash ~/peerdeliver/start-dev.sh

cd ~/peerdeliver

# Kill any leftover processes
pkill -f "ngrok" 2>/dev/null
pkill -f "expo start" 2>/dev/null

echo "Starting API server..."
npm run server > /tmp/pd-server.log 2>&1 &
SERVER_PID=$!
sleep 3

# Check server started
if ! curl -s http://localhost:3001 > /dev/null 2>&1; then
  echo "ERROR: Server failed to start. Check /tmp/pd-server.log"
  cat /tmp/pd-server.log
  exit 1
fi
echo "API server running on port 3001 (PID $SERVER_PID)"

echo "Starting ngrok tunnel for API..."
NGROK_TOKEN=$(grep 'authtoken' ~/.config/ngrok/ngrok.yml | awk '{print $2}')
cd /tmp && npx --yes ngrok@latest http 3001 --authtoken "$NGROK_TOKEN" --log=stdout > /tmp/pd-ngrok.log 2>&1 &
NGROK_PID=$!
cd ~/peerdeliver
sleep 8

# Get tunnel URL
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c 'import sys,json; t=json.load(sys.stdin)["tunnels"]; print(t[0]["public_url"] if t else "")' 2>/dev/null)

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: ngrok tunnel failed. Check /tmp/pd-ngrok.log"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo "API tunnel: $TUNNEL_URL"

# Update app.json with tunnel URL
APP_JSON=~/peerdeliver/packages/app/app.json
python3 -c "
import json
with open('$APP_JSON') as f:
    config = json.load(f)
config['expo']['extra']['apiUrl'] = '$TUNNEL_URL'
with open('$APP_JSON', 'w') as f:
    json.dump(config, f, indent=2)
print('Updated app.json with tunnel URL')
"

echo ""
echo "========================================"
echo "  API:    $TUNNEL_URL"
echo "========================================"
echo ""
echo "Starting Expo (LAN mode)..."
cd ~/peerdeliver/packages/app
npx expo start --lan

# Cleanup on exit
kill $SERVER_PID $NGROK_PID 2>/dev/null
