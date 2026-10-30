# Shlep / PeerDeliver — Security Review (server)

**Scope:** `packages/server` (Node/Express/Prisma/Postgres, socket.io, JWT, Stripe/Payrexx). Authorized defensive review of the owner's own pre-launch app.
**Method:** Full static read of every route, controller, service, middleware, socket handler, and the shared Zod schemas, plus targeted pure-logic tests. **Dynamic probing against a local instance was not possible:** the Prisma query-engine download host `binaries.prisma.sh` is policy-denied by the agent proxy (403 on CONNECT), so the Prisma client could not be generated and the server could not boot against the throwaway Postgres cluster. Every finding below is pinned to `file:line` and carries a code-accurate exploit sequence; the three highest-impact issues were additionally confirmed with isolated logic tests.
**Secrets:** `packages/server/.env` and `*.env.bak*` exist locally (not git-tracked). `stripe_backup_code.txt` **is committed to git** (see H-4). Per instructions, no secret values are printed; only paths are noted. `server.log` contains only a benign npm error — no PII/tokens.

---

## Summary of findings

| # | Sev | Title |
|---|-----|-------|
| C-1 | Critical | Handover codes (`pickupCode`/`deliveryCode`) returned in delivery API responses → driver captures payout without delivering |
| C-2 | Critical | IDOR on `GET /api/deliveries/:id` — any logged-in user reads any delivery (PII + handover codes + payment refs) |
| H-3 | High | Privilege escalation: `PATCH /api/users/profile` lets a user set `role: "admin"` |
| H-4 | High | `stripe_backup_code.txt` committed to git |
| M-5 | Medium | ID-verification (KYC) gate never enforced when claiming/handling deliveries |
| M-6 | Medium | Dev endpoints fail open on default `NODE_ENV` (full KYC/payout bypass) |
| M-7 | Medium | Handover codes generated with `Math.random()`; no per-delivery verify lockout |
| L-8 | Low | No security headers (no helmet); blanket `cors()` reflecting all origins |
| L-9 | Low | Account enumeration on `/api/auth/register` (409 on existing email) |
| L-10 | Low | Chat message content stored raw, unvalidated, unbounded (stored-XSS / abuse) |
| L-11 | Low | 500 handler leaks `err.message` when `NODE_ENV!=='production'` (fail-open default) |
| L-12 | Low | JWT verify sets no `algorithms` allowlist; `JWT_SECRET` min length only 10 |

---

## CRITICAL

### C-1 — Handover codes are returned in every delivery read; a driver can self-confirm pickup and delivery without ever touching the parcel

**Where:** `packages/server/src/services/delivery.ts:12-25` (`DELIVERY_COLS` includes `dr."pickupCode", dr."deliveryCode"`), returned by `getDeliveryById` (`:158`), `getDeliveriesByDriver` (`:137`), `getDeliveriesBySender`, `getDeliveriesByRecipient`, `getNearbyDeliveries`. Consumed with no field stripping by `getMine` (`controllers/delivery.ts:16`) and `getById` (`:58`). Verification logic: `verifyPickup` (`services/delivery.ts:620`), `verifyDelivery` (`:672`).

**Vulnerability:** The 6-digit pickup and delivery codes are the app's entire proof-of-handover mechanism. The design intent: only the **sender** knows `pickupCode` (emailed to them) and only the **recipient** knows `deliveryCode` (emailed/SMSed to them); the driver must obtain each code *in person at the handover* and submit it to prove the parcel physically changed hands. Instead, both codes are embedded in the delivery object the driver legitimately fetches via `GET /api/deliveries/mine` and `GET /api/deliveries/:id`.

`verifyDelivery` only checks `delivery.driverId === driverId`, `status === 'in_transit'`, and `deliveryCode === code` — all of which the assigned driver controls or can read. On success it calls `captureAndPayoutOnDelivered` (`services/payment.ts:204`), capturing the sender's money and transferring the driver's cut.

**Exploit (assigned driver, parcel never delivered):**
```
# Driver is assigned and has moved delivery to in_transit.
GET /api/deliveries/mine         Authorization: Bearer <driver JWT>
#   → response includes "deliveryCode":"<6 digits>" for the driver's own delivery
POST /api/deliveries/<id>/verify-delivery   Authorization: Bearer <driver JWT>
     {"code":"<deliveryCode read above>"}
#   → status=delivered, captureAndPayoutOnDelivered fires → driver is paid.
# The recipient never received the parcel and never confirmed anything.
```
The same applies to `pickupCode` / `verify-pickup`: a driver marks a parcel "picked up / in transit" without collecting it.

**Impact:** Complete defeat of the escrow/proof-of-delivery control. A malicious or compromised driver captures funds and keeps the parcel; the CO₂/stats and recipient notifications all fire as if delivery succeeded. This is the single most serious issue — it breaks the core payment-integrity guarantee of the product.

**Fix:** Never return `pickupCode`/`deliveryCode` in any delivery read. Remove them from `DELIVERY_COLS`, or project them out in `transformDelivery` and expose them only on the dedicated email/SMS channel to the correct party. The verify endpoints should compare against the DB value directly (as they do) but the value must not be in any client-visible payload. Consider role-scoping: the sender/recipient never need the *other* party's code either.

---

### C-2 — IDOR: `GET /api/deliveries/:id` has no authorization check

**Where:** `packages/server/src/controllers/delivery.ts:58-69` (`getById`). Route `routes/delivery.ts:12` (only `authenticate`, no ownership check). Contrast with `getDriverInfo` (`:231-247`) and the chat controller (`controllers/chat.ts:15-23`), which *do* verify participant membership.

**Vulnerability:** `getById` calls `getDeliveryById(req.params.id)` and returns it verbatim to any authenticated caller. Delivery IDs are UUIDs, but they are not secret — they appear in chat payloads, tracking joins, offers, push/deeplinks, and partner flows. The returned object (`DELIVERY_COLS`) contains: pickup + delivery addresses and coordinates, `recipientEmail`, `recipientPhone`, `twintPhone`, `budgetCHF`, `stripePaymentIntentId`, `stripeTransferId`, `paymentStatus`, **and both handover codes**.

**Exploit:**
```
POST /api/auth/register {...}            # any throwaway account
GET  /api/deliveries/<any delivery id>   Authorization: Bearer <attacker JWT>
#   → full delivery incl. recipient home address, phone, payment intent id,
#     pickupCode and deliveryCode for a delivery the attacker has nothing to do with.
```

**Impact:** Mass disclosure of customers' home addresses, phone numbers and payment references (Swiss DSG / GDPR personal data), plus leakage of the handover codes from C-1 to *any* account — so the C-1 payout abuse no longer even requires being the assigned driver to harvest codes at scale.

**Fix:** Add a participant check to `getById`, exactly like `chat.ts`/`getDriverInfo`: resolve the delivery, and return 403 unless `req.user.userId ∈ {senderId, driverId, recipientId}` (admins aside). Reuse `deliveryService.isDeliveryParticipant` (`services/delivery.ts:266`).

---

## HIGH

### H-3 — Privilege escalation: a user can set their own role to `admin`

**Where:** `controllers/user.ts:16-29` (reads `role` from body), `services/user.ts:33-44` (validates only that it is a member of the `UserRole` enum), `prisma/schema.prisma:10-16` (`UserRole` includes `admin`), `middleware/auth.ts:44-46` (`userRole === 'admin'` bypasses every `requireRole`). Confirmed in isolation: `updateProfile accepts role=admin? true`, `admin bypasses requireRole(driver)? true`.

**Vulnerability:** `PATCH /api/users/profile` accepts an arbitrary `role`. The only guard is enum membership — and `admin` is a valid enum value. After changing the DB row, the attacker calls `POST /api/auth/refresh`, which re-issues a JWT with `role` read fresh from the DB (`services/auth.ts:77`), minting an admin token.

**Exploit:**
```
PATCH /api/users/profile  Authorization: Bearer <any user JWT>   {"role":"admin"}
POST  /api/auth/refresh   {"refreshToken":"<their refresh token>"}
#   → new access token with role=admin, which satisfies/bypasses every requireRole(...) gate.
```
The same mechanism lets a `recipient`- or `sender`-only account silently promote itself to `driver`, defeating the role separation that gates route publishing and delivery claiming.

**Impact:** Self-service admin. Today the admin surface is thin (no admin-only routes shipped), so the immediate blast radius is "bypass all `requireRole` gates + become a driver without intent"; it becomes outright critical the moment any admin endpoint is added. Either way it is broken access control / mass-assignment.

**Fix:** Do not accept `role` from the profile-update body. Remove it from the destructure in `controllers/user.ts:16` and `services/user.ts`. Manage role transitions through a dedicated, gated flow; never allow `admin` to be self-assigned. If senders must be able to opt into driving, handle that as an explicit, verification-gated action, not a free-form profile field.

### H-4 — `stripe_backup_code.txt` is committed to git

**Where:** repo root `stripe_backup_code.txt` — confirmed tracked (`git ls-files` matches; 190 bytes). Value not read/printed per instructions.

**Vulnerability:** A Stripe-related backup/recovery secret is in version control. Anyone with repo history access (current or future collaborators, a leaked clone, a mis-set repo visibility) obtains it, and git history preserves it even after deletion.

**Impact:** Potential compromise of Stripe account recovery / 2FA depending on what the code is. For a payments app this is high-impact.

**Fix:** Treat the secret as compromised and rotate/regenerate it in Stripe now. Remove the file and purge it from history (`git filter-repo` / BFG), then force-push and re-clone. Add the filename to `.gitignore`. (`.env` is correctly ignored already.)

---

## MEDIUM

### M-5 — The ID-verification (KYC) gate is never enforced when claiming or handling a delivery

**Where:** `services/delivery.ts` `assignDelivery:545` and `acceptOffer:441` gate only on `paymentService.driverCanReceivePayouts` (`services/payment.ts:153-157`). Nothing in the claim/accept/verify path checks `idVerified` or `verificationStatus`.

**Vulnerability:** `driverCanReceivePayouts` returns `true` unconditionally when Stripe is not configured (simulated mode), and otherwise only checks `stripePayoutsEnabled` (Stripe **Connect onboarding**). Stripe **Identity** (`idVerified`, set only by the identity webhook, `services/payment.ts:459`) is a *separate* signal that is collected but never consulted when deciding who may carry a stranger's parcel. So:
- In simulated mode (no `STRIPE_SECRET_KEY`): any account can claim and fully handle deliveries with zero verification.
- In real mode: a driver who finishes payout onboarding but never passes (or fails) ID verification can still claim and handle deliveries.

**Impact:** The product's trust/safety promise ("verified drivers") is not enforced on the path that matters. Unverified / ID-rejected individuals can take custody of parcels.

**Fix:** Add an explicit gate in `assignDelivery`/`acceptOffer` (and ideally `verifyPickup`) requiring `verificationStatus === 'verified'` (or at least `idVerified && phoneVerified`) before a driver may take a delivery, independent of payout status.

### M-6 — Dev endpoints fail open on the default `NODE_ENV`

**Where:** `controllers/verification.ts:192-206` (`devVerifyAll` → sets `idVerified/phoneVerified/plateVerified/verificationStatus='verified'`) and `controllers/payment.ts:59-70` (`devCompleteOnboarding` → `stripePayoutsEnabled=true`). Both guard with `if (env.NODE_ENV !== 'development') return 404`. But `config/env.ts:8` defaults `NODE_ENV` to **`'development'`**.

**Vulnerability:** These routes are live whenever `NODE_ENV` is not explicitly set. A single valid JWT then fully self-verifies the caller and enables payouts — bypassing both the KYC gate (M-5) and Connect onboarding.
```
POST /api/users/verification/dev-verify-all   Authorization: Bearer <any JWT>
POST /api/payments/connect/dev-complete       Authorization: Bearer <any JWT>
```
The documented Render deploy sets `NODE_ENV=production` (`render.yaml:26-27`), so the primary production target is protected. The risk is any other deploy/host/container (the Docker setup, a staging box, a misconfiguration) where the var is unset — it fails *open*.

**Impact:** Instant, self-service KYC + payout bypass on any deploy that forgets one env var. The default should never be the insecure one.

**Fix:** Default `NODE_ENV` to `'production'`, or gate these endpoints behind an explicit, separate flag (e.g. `ENABLE_DEV_ENDPOINTS=true`) that is off unless deliberately set. Better still, exclude dev routes from the build entirely in production.

### M-7 — Handover codes use `Math.random()`; no per-delivery verification lockout

**Where:** `utils/apiResponse.ts:11-18` (`generateCode` uses `Math.random()`); verify endpoints rate-limited only by the global `apiLimiter` (100/min/IP, `middleware/rateLimiter.ts:11`) — no per-delivery attempt counter or lockout.

**Vulnerability:** Codes are drawn from a non-cryptographic PRNG over a 10⁶ keyspace (confirmed). `Math.random()` output is predictable given enough samples, and there is no lockout after repeated wrong codes on a given delivery. On its own this is lower-risk because `verifyPickup`/`verifyDelivery` require being the assigned driver — but it compounds C-1/C-2 (once a code leaks or is guessed, nothing else stands in the way) and weakens any future flow that trusts the code's secrecy.

**Fix:** Generate codes with `crypto.randomInt(0, 1_000_000)` (zero-padded). Add a per-delivery wrong-attempt counter that locks the code and forces reissue after ~5 failures. Keep the codes server-only (C-1).

---

## LOW

### L-8 — No security headers; blanket CORS
`index.ts:16` uses `app.use(cors())` (reflects any origin) and there is no `helmet`. Auth is Bearer-token (not cookies), so open CORS is not directly exploitable, but responses carry no `Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc. **Fix:** add `helmet()`; set an explicit CORS allowlist for the app origins (the partner/forms routers already scope their own CORS).

### L-9 — Account enumeration on registration
`services/auth.ts:10-12` returns `409 "Email already registered"`, revealing which addresses have accounts. (Login is correctly generic — `:51`,`:56`.) **Fix:** return a neutral response and send a "you already have an account" email out-of-band, or accept the trade-off consciously.

### L-10 — Chat content stored raw, unvalidated, unbounded
`controllers/chat.ts:35-52` passes `req.body.content` straight to `chatService.createMessage` (`services/chat.ts:11`) with no Zod schema, no length cap, no sanitization. Risk: stored XSS if the web client ever renders message content as HTML (React/RN escape by default, so this is latent, not confirmed), and an abuse/DoS vector (arbitrarily large messages). **Fix:** validate with a schema (`z.string().min(1).max(2000)`); ensure the web renderer never uses `dangerouslySetInnerHTML` for message content.

### L-11 — 500 handler leaks internal messages on non-production
`middleware/errorHandler.ts:27` returns `err.message` to the client unless `NODE_ENV==='production'` — same fail-open default as M-6. **Fix:** default to the generic message; only expand when a dev flag is explicitly on.

### L-12 — JWT hardening
`middleware/auth.ts:27` and `socket/index.ts:27` call `jwt.verify` without an `algorithms` allowlist. Not exploitable today (string HMAC secret; `alg:none` and RS/HS confusion are rejected with a symmetric secret), but pin `{ algorithms: ['HS256'] }` defensively. `config/env.ts:5` allows a `JWT_SECRET` as short as 10 chars — raise the minimum to ≥32 and ensure access/refresh secrets differ.

---

## What looks solid (so the owner knows what not to touch)
- Chat and live-tracking endpoints correctly enforce participant membership (`controllers/chat.ts`, `socket/trackingHandler.ts`) — C-2 is the one read path that was missed.
- Password hashing is bcrypt rounds=12 (`utils/password.ts`). Login is not enumerable.
- SQL: all raw queries are parameterized (`$queryRaw` tagged templates / `$queryRawUnsafe` with `$1` bind params); the enum whitelist for status/size prevents injection. No string-concatenated user input into SQL was found.
- Stripe webhook verifies the signature with `constructEvent` and the raw body (`controllers/webhook.ts`); handlers are idempotent with status-guarded `updateMany`. Payrexx webhook verifies an HMAC with `timingSafeEqual` *and* re-reads the gateway from the API, and checks the amount (`controllers/payrexx.ts`).
- Delivery status transitions are validated server-side with an actor-authorization check (`services/delivery.ts:167-209`), and claim/offer/accept use conditional `UPDATE ... WHERE status=...` with row-count checks to prevent races/double-assignment.
- Identity (`idVerified`) can only be set by the Stripe webhook, not by a client assertion — the old self-certify hole is closed (the remaining gap is M-5: it is set correctly but never *enforced*).
