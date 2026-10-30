# Shlep / PeerDeliver — stress & concurrency findings

Date: 2026-10-30. Reviewer: performance/reliability pass on `packages/server`.
Working copy: `/home/claude/shlep/work-stress`. SIM payment mode (no Stripe keys; no real money moved).

## How this was tested

- Threw-away Postgres 16 + PostGIS 3.4 cluster on port 5435; applied all 18 Prisma
  migrations by SQL (the Prisma **schema-engine** download from `binaries.prisma.sh`
  is blocked by egress policy, so `prisma generate`/`migrate` can't run here and the
  full HTTP server can't boot — the query engine itself is WASM and fine).
- Because the server couldn't boot, the concurrency races were reproduced at the
  **database layer** with a raw-`pg` harness (`scratchpad/race.mjs`) that mirrors the
  exact SQL and control flow in `services/delivery.ts` + `services/payment.ts`. This
  is the authoritative test for "does exactly one win" — the HTTP layer only forwards
  to these functions.
- Hot-path query cost measured with `EXPLAIN (ANALYZE, BUFFERS)` against 5,000 seeded
  pending deliveries.

Measured results from the harness:
```
S1 double-claim: 30 concurrent assign() -> winners=1 (expect 1); status=requested   [PASS]
S2 duplicate verify-delivery: 10 concurrent -> capture-writes=5; driver.totalDeliveries=10 (expect 1), co2Saved=25 (expect 2.5)
S3 cancel-after-delivered (TOCTOU): verify.captured=true, cancel.rowsUpdated=0, cancel.refunded=true
   -> final status=delivered, paymentStatus=refunded, driverPayoutCHF=45.5, refundedCHF=50   [MONEY BUG]
```

---

## CRITICAL

### C1 — A cancel racing a completed delivery refunds the sender on an already-paid, code-confirmed delivery
**File:** `packages/server/src/services/delivery.ts:195-207` (`updateDeliveryStatus`), with
`packages/server/src/services/payment.ts:315` (`voidOnCancel`) and the transition table
`packages/shared/src/constants/delivery-status.ts:34` (`in_transit: ['delivered','cancelled']`).

**Root cause:** `updateDeliveryStatus` runs a *conditional* update
(`WHERE id=$4 AND status=$5`) but **ignores its row count**, then calls `voidOnCancel(id)`
based only on the *requested* status:
```ts
await prisma.$queryRawUnsafe(`UPDATE ... WHERE id=$4 AND status=$5::"DeliveryStatus"`, ...); // result discarded
if (status === 'cancelled') { await paymentService.voidOnCancel(id); }  // runs even if 0 rows changed
```
`voidOnCancel` re-reads the row and refunds whenever `paymentStatus` is `authorised`
**or `captured`**. So the refund fires even though the status UPDATE changed nothing.

**How triggered:** sender's cancel request reads the delivery while it is `in_transit`
(passes the `in_transit → cancelled` transition gate); the driver's `verify-delivery`
then completes (`status=delivered`, `paymentStatus=captured`, driver paid); the cancel
proceeds — its UPDATE matches 0 rows, but `voidOnCancel` refunds anyway.

**Measured impact (S3):** one delivery ended as `status=delivered`, `driverPayoutCHF=45.5`
**and** `refundedCHF=50`, `paymentStatus=refunded`. The driver did the job and is recorded
as paid, while the sender is fully refunded. In **real (Stripe) mode** `voidOnCancel`
additionally calls `transfers.createReversal` — it actively **claws CHF 45.50 back from the
driver** who already delivered, then refunds the sender CHF 50. Net platform/driver loss =
full ticket, per race. This is the exact inverse of the "a failed payout no longer fails the
handover" fix: here a late cancel *unwinds* a good handover.

**Fix:** make the mutation decide the side effect. Capture the row count and only run
`voidOnCancel` when the cancel actually transitioned the row:
```ts
const applied = await prisma.$executeRawUnsafe(`UPDATE ... WHERE id=$4 AND status=$5`, ...);
if (applied === 0) throw new AppError(409, 'Delivery already moved on');
if (status === 'cancelled') await paymentService.voidOnCancel(id);
```
Additionally, `voidOnCancel` should refuse to refund a `captured`/`delivered` delivery
(refund only from `authorised`), so it is safe even if reached by another path.

---

## HIGH

### H1 — Handover/confirm/reject use read-check-then-UNCONDITIONAL update (no status guard, no atomicity)
**File:** `packages/server/src/services/delivery.ts` — `confirmDelivery:582`, `verifyPickup:628`,
`verifyDelivery:679`, `rejectDriver:825`. Each is `UPDATE ... WHERE id = $1` with **no
`AND status = …`** and **no row-count check** — unlike the claim/offer paths
(`assignDelivery:557`, `offerToRoute:346`, `acceptOffer:457`, `declineOffer:518`,
`withdrawOffer:400`), which correctly use `WHERE … AND status = …` + `applied === 0`.
This is an internal inconsistency: the pattern that makes claiming safe was never applied
to the handover transitions.

**Consequence — non-idempotent side effects under duplicate submission (`verifyDelivery`):**
the function also does, as separate autocommit statements (no transaction):
`user.update({ totalDeliveries: {increment:1}, co2Saved:{increment} })` and
`captureAndPayoutOnDelivered`.

**Measured impact (S2):** 10 concurrent `verify-delivery` calls (double-tap / client retry /
at-least-once webhook) → **driver.totalDeliveries = 10 (expected 1), co2Saved = 25 (expected
2.5)**, and 5 of 10 calls wrote `paymentStatus=captured` and rewrote the payout split. Real
money is saved only by the Stripe idempotency key `delivery-transfer-${deliveryId}`
(payment.ts:279) — i.e. double-**payout** is prevented *at Stripe*, not in the app — but the
driver's public delivery count and CO₂ stats are inflated arbitrarily, the split columns churn,
and 5 redundant Stripe transfer calls are issued per burst. The same non-guard lets `verifyPickup`
emit duplicate "picked up" emails/SMS to the recipient and duplicate chat messages.

**Fix:** use the same atomic pattern everywhere — e.g.
`UPDATE … SET status='delivered' WHERE id=$1 AND status='in_transit'` and branch on the
affected row count; do the status change + stat increment + capture inside a single
`prisma.$transaction` so a duplicate call is a no-op and a mid-flight crash can't leave
partial state.

### H2 — Driver discovery query (`getNearbyDeliveries`) has no spatial index: full seq scan + geography math on every poll
**File:** `packages/server/src/services/delivery.ts:221-248`; schema uses
`Unsupported("geometry(Point,4326)")` (schema.prisma:134-136) so Prisma creates **no GiST
index**, and none of the 18 migrations adds one (verified: only btree indexes on
`senderId/driverId/recipientId/status` exist on `delivery_requests`).

**Measured (`EXPLAIN ANALYZE`, 5,000 pending rows):**
`Seq Scan on delivery_requests` computing `ST_Distance(::geography)` for every pending row,
planner cost **62,748**, ~16 ms/call, and the planner mis-estimates the geo predicate as
`rows=1`. Adding `CREATE INDEX … USING GIST ((\"pickupPoint\"::geography))` switched it to a
**Bitmap Index Scan** (cost 62,748 → **12,531**, ~5×; candidate set narrowed before the
expensive distance sort). This is the driver's primary foreground query, polled by every active
driver; at real pending-volume × driver count it is the first CPU/IO hotspot and the first thing
to saturate the connection pool.

**Fix:** add a migration `CREATE INDEX CONCURRENTLY dr_pickup_gix ON delivery_requests USING GIST (("pickupPoint"::geography));`
(and one on `deliveryPoint` if route-destination search grows). Keep it in a hand-written SQL
migration since Prisma can't express it.

---

## MEDIUM

### M1 — Unbounded list endpoints (no pagination)
`getDeliveriesBySender:129`, `getDeliveriesByDriver:137`, `getDeliveriesByRecipient:145`
all `SELECT … ORDER BY createdAt DESC` with **no LIMIT**. `getMine` (controllers/delivery.ts:35)
fires all three and merges in memory for every app foreground. A heavy sender/driver returns and
serializes their entire lifetime of deliveries each call — unbounded payload + memory growth under
load. (`getNearbyDeliveries` does cap at 50.) **Fix:** add keyset pagination (`WHERE createdAt < $cursor LIMIT n`).

### M2 — `getDeliveriesByRecipient` scans on `LOWER(recipientEmail)` with no index
**File:** delivery.ts:148-154. `WHERE … OR LOWER("recipientEmail") = LOWER($2)` — no index on
`recipientEmail` (verified absent). Runs inside every `getMine`. **Fix:** functional index
`CREATE INDEX ON delivery_requests (LOWER("recipientEmail"))`, or store/normalize the email lower-cased
and index it.

### M3 — Prisma connection pool unbounded/undersized for the slow queries above
`config/database.ts:5` constructs `new PrismaClient()` with no `connection_limit`/`pool_timeout`,
and `DATABASE_URL` sets none. Default pool = `cpus*2+1`. With H2's ~16 ms seq-scan under many
concurrent drivers, connections are held long enough to exhaust the pool; further requests queue
and then fail with Prisma's pool timeout (P2024) — the service "falls over" at the DB layer, not
the HTTP layer. **Fix:** set `connection_limit` and `pool_timeout` explicitly and size against
Postgres `max_connections`; fix H2 to shorten hold time.

### M4 — Global rate limiter is per-IP and in-memory; `trust proxy` makes login throttle spoofable
`index.ts:15` `app.set('trust proxy', 1)` + `middleware/rateLimiter.ts`: `apiLimiter` = 100 req/min
**per IP, globally**. Mobile-carrier/corporate NAT puts many real users behind one IP → they share
one 100/min bucket (false 429s under normal load; also throttles any single-origin load test).
`authLimiter` (20/15min, login/register brute-force guard) keys on the forwarded IP — with
`trust proxy:1` in a deployment where clients can reach the app directly or set `X-Forwarded-For`,
the limit is bypassable by rotating the header. The in-memory store also won't share counts across
instances if the service scales horizontally (render.yaml). **Fix:** key by user/token where
authenticated, verify the real proxy hop count, and use a shared store (Redis) if multi-instance.

---

## LOW / notes

- **L1 — `verifyPickup`/`verifyDelivery` 6-digit code has no per-delivery attempt lockout**
  (delivery.ts:624, 676); only the global 100/min limiter applies. Brute-force is bounded in
  practice because the caller must already be the assigned `driverId`, so exposure is low, but a
  per-delivery attempt counter would be cheap defense-in-depth.
- **L2 — No transaction around multi-write flows.** `verifyDelivery` performs 7+ separate
  autocommit statements (status, co2 columns, two `user` increments, chat message, capture). A crash
  or error between them leaves partial state (e.g. stats credited but not captured). Wrap each
  lifecycle mutation in `prisma.$transaction`.
- **L3 — Blocking/sync work on the socket connect path:** `socket/index.ts:39,48` `console.log`
  on every connect/disconnect (synchronous stdout) and no per-user socket cap; fine now, worth
  watching at connection scale.
- **Verified good:** double-**claim** is correctly prevented — 30 concurrent `assignDelivery`
  calls yield exactly one winner (atomic `WHERE … AND status='pending' AND driverId IS NULL` +
  row-count). The `offerToRoute`/`acceptOffer`/`declineOffer`/`withdrawOffer` paths use the same
  safe pattern. Stripe pay-in/transfer/refund/reversal all carry idempotency keys
  (payment.ts:177,279,345,378). The prior "failed payout no longer fails the handover" change is
  real and correct (delivery.ts:771-778) — but see C1 for its inverse still being open.

## Couldn't complete here
- Full HTTP load test (autocannon/p50/p95/p99, throughput, error-rate curve) — needs the booted
  server, blocked by the Prisma schema-engine egress denial. The DB-layer harness covers the
  correctness-under-contention questions, which were the priority; a follow-up load run should
  target `POST /api/auth/login` (bcrypt cost 10 is CPU-bound), `GET /api/deliveries/nearby`
  (H2 hotspot), and `GET /api/deliveries/mine` (M1/M2).
