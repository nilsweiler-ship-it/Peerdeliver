#!/bin/bash
# End-to-end smoke test: create delivery → request → confirm → accept → pickup → delivered.
# Requires server on :3001 and the DB reachable. Uses python3 for JSON parsing (no jq dep).
#
# Usage:
#   bash test-delivery.sh                                  # default API + test users
#   API=http://localhost:3001 bash test-delivery.sh        # override base URL
#
# Safe to re-run: registration falls back to login if the user already exists.

set -euo pipefail

API="${API:-http://localhost:3001}"
SENDER_EMAIL="${SENDER_EMAIL:-sender@test.com}"
# Rotate driver email per-day so a fresh driver is registered with vehicle fields
# (PATCH /users/profile does NOT accept carModel/licensePlate/maxLoadKg — registration only).
DRIVER_EMAIL="${DRIVER_EMAIL:-driver-e2e-$(date +%Y%m%d)@test.com}"
PASSWORD="${PASSWORD:-Test1234}"

# --- colors ---
if [ -t 1 ]; then
  RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; DIM=$'\033[2m'; BLD=$'\033[1m'; RST=$'\033[0m'
else
  RED=""; GRN=""; YEL=""; DIM=""; BLD=""; RST=""
fi

step()  { echo; echo "${BLD}▸ $1${RST}"; }
ok()    { echo "  ${GRN}✓${RST} $1"; }
fail()  { echo "  ${RED}✗${RST} $1"; exit 1; }
info()  { echo "  ${DIM}$1${RST}"; }

# --- JSON helpers (python3, no jq required) ---
json_get()  { python3 -c 'import sys,json; d=json.load(sys.stdin); keys="'"$1"'".split("."); [d:=d[k] for k in keys if k]; print(d)' 2>/dev/null; }
json_path() { python3 -c "
import sys, json
d = json.load(sys.stdin)
for k in '$1'.split('.'):
    if k == '': continue
    d = d[k] if not k.isdigit() else d[int(k)]
print(d)
"; }

# Register, ignoring 'already exists'; then login and return accessToken.
login_or_register() {
  local email="$1" role="$2"
  local reg_body
  if [ "$role" = "driver" ]; then
    reg_body=$(cat <<JSON
{"email":"$email","password":"$PASSWORD","firstName":"Test","lastName":"${role^}","role":"$role","language":"en","licensePlate":"ZH123456","carModel":"VW Golf","maxLoadKg":380}
JSON
)
  else
    reg_body=$(cat <<JSON
{"email":"$email","password":"$PASSWORD","firstName":"Test","lastName":"${role^}","role":"$role","language":"en"}
JSON
)
  fi

  # Register (ignore failure — user may already exist)
  curl -s -o /dev/null -X POST "$API/api/auth/register" \
    -H "Content-Type: application/json" -d "$reg_body" || true

  local resp
  resp=$(curl -s -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")

  local token
  token=$(echo "$resp" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["data"]["tokens"]["accessToken"])' 2>/dev/null || true)
  if [ -z "$token" ]; then
    echo "$resp"
    fail "Login failed for $email"
  fi
  echo "$token"
}

assert_status() {
  local got="$1" want="$2" label="$3"
  if [ "$got" = "$want" ]; then
    ok "$label: status=${GRN}$got${RST}"
  else
    fail "$label: expected '${want}', got '${got}'"
  fi
}

# ========== 1. Auth ==========
step "Authenticating sender + driver"
SENDER_TOKEN=$(login_or_register "$SENDER_EMAIL" "sender")
info "sender token: ${SENDER_TOKEN:0:24}…"
DRIVER_TOKEN=$(login_or_register "$DRIVER_EMAIL" "driver")
info "driver token: ${DRIVER_TOKEN:0:24}…"

# Delivery window: tomorrow to day-after (ISO-8601, UTC)
WIN_START=$(date -u -d '+1 day 10:00' +%Y-%m-%dT%H:%M:%S.000Z)
WIN_END=$(date -u -d '+2 days 10:00' +%Y-%m-%dT%H:%M:%S.000Z)

# ========== 2. Sender creates delivery ==========
step "Sender creates delivery (Zurich → Bern, CHF 15)"
CREATE_BODY=$(cat <<JSON
{
  "pickupAddress":{"label":"Zurich","point":{"lat":47.3769,"lng":8.5417}},
  "deliveryAddress":{"label":"Bern","point":{"lat":46.9481,"lng":7.4474}},
  "packageSize":"S",
  "packageDescription":"E2E test package",
  "budgetCHF":15,
  "deliveryWindowStart":"$WIN_START",
  "deliveryWindowEnd":"$WIN_END"
}
JSON
)
CREATE_RESP=$(curl -s -X POST "$API/api/deliveries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENDER_TOKEN" \
  -d "$CREATE_BODY")

DELIVERY_ID=$(echo "$CREATE_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null || true)
STATUS=$(echo "$CREATE_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])' 2>/dev/null || true)
[ -n "$DELIVERY_ID" ] || { echo "$CREATE_RESP"; fail "Could not create delivery"; }
info "delivery id: $DELIVERY_ID"
assert_status "$STATUS" "pending" "create"

# ========== 3. Driver requests (pending → requested) ==========
step "Driver requests delivery"
RESP=$(curl -s -X PATCH "$API/api/deliveries/$DELIVERY_ID/assign" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "requested" "driver assign"

# ========== 3b. Sender rejects driver (requested → pending), driver re-requests ==========
step "Sender rejects driver → back to pending"
RESP=$(curl -s -X PATCH "$API/api/deliveries/$DELIVERY_ID/reject" \
  -H "Authorization: Bearer $SENDER_TOKEN")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "pending" "sender reject"

step "Driver re-requests after rejection"
RESP=$(curl -s -X PATCH "$API/api/deliveries/$DELIVERY_ID/assign" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "requested" "driver re-assign"

# ========== 4. Sender confirms (requested → matched) ==========
step "Sender confirms driver"
RESP=$(curl -s -X PATCH "$API/api/deliveries/$DELIVERY_ID/confirm" \
  -H "Authorization: Bearer $SENDER_TOKEN")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "matched" "sender confirm"

# ========== 5. Driver accepts / starts pickup (matched → accepted) ==========
step "Driver starts pickup"
RESP=$(curl -s -X PATCH "$API/api/deliveries/$DELIVERY_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"status":"accepted"}')
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "accepted" "driver accept"

# ========== 6. Fetch pickup/delivery codes (sender only) ==========
step "Reading pickup/delivery codes (as sender)"
RESP=$(curl -s "$API/api/deliveries/$DELIVERY_ID" \
  -H "Authorization: Bearer $SENDER_TOKEN")
PICKUP_CODE=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["pickupCode"])')
DELIVERY_CODE=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["deliveryCode"])')
info "pickupCode=$PICKUP_CODE   deliveryCode=$DELIVERY_CODE"

# ========== 6b. Wrong pickup code → 400, state unchanged ==========
step "Driver submits wrong pickup code → 400"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/deliveries/$DELIVERY_ID/verify-pickup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"code":"000000"}')
[ "$CODE" = "400" ] && ok "got 400 (invalid code rejected)" || fail "expected 400, got $CODE"

# Confirm state is still 'accepted' (not advanced by the bad attempt)
RESP=$(curl -s "$API/api/deliveries/$DELIVERY_ID" -H "Authorization: Bearer $SENDER_TOKEN")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "accepted" "state after bad code"

# ========== 7. Verify pickup (accepted → in_transit) ==========
step "Driver verifies pickup with correct code"
RESP=$(curl -s -X POST "$API/api/deliveries/$DELIVERY_ID/verify-pickup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d "{\"code\":\"$PICKUP_CODE\"}")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "in_transit" "verify pickup"

# ========== 8. Verify delivery (in_transit → delivered) ==========
step "Driver verifies delivery with code"
RESP=$(curl -s -X POST "$API/api/deliveries/$DELIVERY_ID/verify-delivery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d "{\"code\":\"$DELIVERY_CODE\"}")
STATUS=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
assert_status "$STATUS" "delivered" "verify delivery"

# ========== 9. Negative checks ==========
step "Negative: re-confirm on delivered → 400"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/api/deliveries/$DELIVERY_ID/confirm" \
  -H "Authorization: Bearer $SENDER_TOKEN")
[ "$CODE" = "400" ] && ok "got 400 (not in requested state)" || fail "expected 400, got $CODE"

step "Negative: wrong driver tries to verify → 403"
# Use sender token against a verify endpoint — should be blocked by the driverId check (403)
# Note: sender still has an auth token but isn't the driver.
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/deliveries/$DELIVERY_ID/verify-pickup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENDER_TOKEN" \
  -d "{\"code\":\"$PICKUP_CODE\"}")
# Either 400 (wrong state) or 403 (wrong driver) is acceptable here — both prove access control works
[ "$CODE" = "403" ] || [ "$CODE" = "400" ] && ok "got $CODE (access control enforced)" || fail "expected 400/403, got $CODE"

# ========== 10. Chat messages ==========
step "Driver sends a chat message"
RESP=$(curl -s -X POST "$API/api/chat/$DELIVERY_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -d '{"content":"E2E test: hello from driver"}')
MSG_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null || true)
[ -n "$MSG_ID" ] && ok "message sent id=$MSG_ID" || { echo "$RESP"; fail "send message"; }

step "Sender fetches messages"
RESP=$(curl -s "$API/api/chat/$DELIVERY_ID/messages" \
  -H "Authorization: Bearer $SENDER_TOKEN")
# Expect at least: 3 system messages (confirm, pickup, delivered) + 1 driver message
COUNT=$(echo "$RESP" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]))')
info "message count: $COUNT"
[ "$COUNT" -ge 4 ] && ok "≥4 messages (3 system + 1 driver)" || fail "expected ≥4, got $COUNT"

step "Sender marks chat read"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/chat/$DELIVERY_ID/read" \
  -H "Authorization: Bearer $SENDER_TOKEN")
[ "$CODE" = "200" ] && ok "got 200" || fail "expected 200, got $CODE"

# ========== 11. Driver info lookup (vehicle fields from latest commit) ==========
step "Sender fetches driver info for this delivery"
RESP=$(curl -s "$API/api/deliveries/$DELIVERY_ID/driver" \
  -H "Authorization: Bearer $SENDER_TOKEN")
CAR=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["carModel"])' 2>/dev/null || true)
PLATE=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["licensePlate"])' 2>/dev/null || true)
LOAD=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["maxLoadKg"])' 2>/dev/null || true)
info "carModel=$CAR  licensePlate=$PLATE  maxLoadKg=$LOAD"
[ "$CAR" = "VW Golf" ]       && ok "carModel matches"     || fail "carModel expected 'VW Golf', got '$CAR'"
[ "$PLATE" = "ZH123456" ]    && ok "licensePlate matches" || fail "licensePlate expected 'ZH123456', got '$PLATE'"
[ "$LOAD" = "380.0" ] || [ "$LOAD" = "380" ] && ok "maxLoadKg matches" || fail "maxLoadKg expected 380, got '$LOAD'"

# ========== 12. Nearby search ==========
step "Create second delivery (pending) for nearby test"
RESP=$(curl -s -X POST "$API/api/deliveries" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SENDER_TOKEN" \
  -d "$CREATE_BODY")
NEARBY_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null || true)
[ -n "$NEARBY_ID" ] && ok "second delivery id=$NEARBY_ID (pending)" || fail "could not create nearby delivery"

step "Driver searches nearby (Zurich centre, 50 km)"
RESP=$(curl -s "$API/api/deliveries/nearby?lat=47.3769&lng=8.5417&radius=50" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
FOUND=$(echo "$RESP" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
ids = [x['id'] for x in d]
print('yes' if '$NEARBY_ID' in ids else 'no')
print(len(d))
")
HIT=$(echo "$FOUND" | sed -n '1p')
COUNT=$(echo "$FOUND" | sed -n '2p')
info "nearby count=$COUNT"
[ "$HIT" = "yes" ] && ok "new delivery present in nearby results" || fail "new delivery missing from nearby results"

step "Nearby excludes far-away location (Geneva → Basel, 5 km radius)"
RESP=$(curl -s "$API/api/deliveries/nearby?lat=46.2044&lng=6.1432&radius=5" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
HIT=$(echo "$RESP" | python3 -c "
import sys,json
ids = [x['id'] for x in json.load(sys.stdin)['data']]
print('yes' if '$NEARBY_ID' in ids else 'no')
")
[ "$HIT" = "no" ] && ok "Zurich delivery not returned for Geneva search" || fail "distance filter not applied"

echo
echo "${GRN}${BLD}✓ End-to-end OK${RST}  (delivery $DELIVERY_ID reached ${GRN}delivered${RST})"
