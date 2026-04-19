#!/bin/bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sender@test.com","password":"Test1234"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["tokens"]["accessToken"])')

echo "Token: ${TOKEN:0:20}..."

# Create delivery
curl -sv -X POST http://localhost:3001/api/deliveries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pickupAddress":{"label":"Zurich","point":{"lat":47.3769,"lng":8.5417}},
    "deliveryAddress":{"label":"Bern","point":{"lat":46.9481,"lng":7.4474}},
    "packageSize":"S",
    "packageDescription":"Test package",
    "budgetCHF":15,
    "deliveryWindowStart":"2026-03-28T10:00:00.000Z",
    "deliveryWindowEnd":"2026-03-29T10:00:00.000Z"
  }' 2>&1
