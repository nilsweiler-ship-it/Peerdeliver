# Shlep / PeerDeliver — QA end-to-end run

**Date:** 2026-10-30 · **Tester:** QA agent · **Build:** `/home/claude/shlep/work-qa` (snapshot)
**Environment:** local Postgres 16 + PostGIS 3.4 on :5433, API on :3001 with **simulated payments** (no Stripe key), Expo web dev export served locally, Playwright (Chromium, 390×844, tz Europe/Zurich).

---

## Verdict: **NOT MVP-ready (N)**

The happy path works end to end: sign-up, route, request, claim, confirm, pickup code, delivery code, 9 % / CHF 1.50 split, earnings and chat all behave as designed. Cent-exact split arithmetic is solid, and so are double-confirm, double-accept and concurrent double-handover handling.

The trust model is broken, though, and Shlep is a trust product:

1. **The 6-digit handover codes are not secret.** Any logged-in user can read both codes of any delivery. That includes the driver, who can then confirm "delivered" without ever meeting the recipient and trigger the payout.
2. **The state machine has bypasses.** `PATCH /status` jumps to `picked_up` or `delivered` without any code. `reject` resets **delivered/in-transit** deliveries to `pending`. A follow-up cancel then refunds the sender in full **after** the driver was paid; in Stripe mode the driver's transfer is reversed.
3. **Payment is not enforced.** Unpaid deliveries are listed, claimed and completed, and the driver is told `payout.ok: true`. In real Stripe mode, the simulated-TWINT endpoint is still live, so a sender can mark a delivery "authorised" without paying (code review, not executed).
4. **No ID-verification gating, no ratings API, no disputes, no expiry.** These are all listed as MVP features in the brief.

All of these are fixable in a few days of focused server work. None needs a redesign. Re-test after fixing the Critical/High rows below.

---

## What was run and the result

| Check | Result | Notes |
|---|---|---|
| `npm install` | ✅ | 921 packages |
| `npm run db:generate` | ⚠️ env | `binaries.prisma.sh` is blocked by the sandbox proxy. Workaround in the **work-qa copy only**: generator `previewFeatures=["queryCompiler","driverAdapters"]`, `engineType="client"`, `@prisma/adapter-pg`, and migrations applied via `psql`. `packages/server/src/config/database.ts` and `schema.prisma` were patched in work-qa; originals were not touched. |
| `npm run typecheck` | ❌ **FAIL** | server ✅, server scripts ✅, **app ❌**: `packages/app/ShowcaseRoot.tsx:20-21` imports `@expo-google-fonts/hanken-grotesk` and `@expo-google-fonts/jetbrains-mono`, but neither is in `packages/app/package.json`. CI (`verify:all`) is red because of this. |
| `npm run preflight` | ✅ | "416 keys × 4" i18n parity, but it misses hard-coded strings (see i18n findings) |
| `npm run contrast` | ✅ | 21/21 |
| `npm run price:check` | ✅ | |
| `npm run payment:battle` | ✅ 7 / ⏭ 1 | Stripe money-path suite skipped (no `sk_test_` key; by design I used none) |
| `npm run e2e` | ⏭ not run | Hard-wired to the **deployed** API + real `STRIPE_SECRET_KEY` + `E2E_PASSWORD`. Out of scope (no real keys, no prod traffic). |
| `npm run e2e:ui` (Maestro) | ⏭ not run | needs macOS simulator |
| API lifecycle probe | 38 pass / 29 fail + follow-ups | scripts kept at `/tmp/claude-0/-home-claude/a3e240ea-94ee-5e3c-9a62-a03cddf9fcf9/scratchpad/qa/api.mjs` and `api2.mjs` |
| Expo web + Playwright | ✅ boots, login and tabs work | Screenshots in `reports/qa-shots/`. The dev export still points at `https://api.shlep.ch` because `packages/app/.env.local` sets `EXPO_PUBLIC_API_URL`, so I intercepted and rerouted to localhost. No prod calls went out: the proxy blocked them before interception was added. |

---

## Findings (ranked)

Unless stated otherwise, every row was reproduced live against the local API. Paths are relative to `packages/`.

### Critical

| # | Title | File:line | Repro | Expected vs actual | Suggested fix |
|---|---|---|---|---|---|
| C1 | **Handover codes leak to anyone; the driver can self-confirm delivery** | `server/src/controllers/delivery.ts:58` (getById has no participant check), `server/src/services/delivery.ts:12-24` (`DELIVERY_COLS` selects `pickupCode`, `deliveryCode` for every reader), also `/deliveries/nearby` (`delivery.ts:221`) and `/deliveries/mine` | 1. Sender creates a delivery. 2. Any **unrelated** user calls `GET /api/deliveries/:id`, or any driver calls `GET /deliveries/nearby`. 3. Assigned driver: `GET /deliveries/:id` → reads `deliveryCode` → `POST /verify-delivery` with it. | **Expected:** the delivery code is known only to sender/recipient, the pickup code only to the sender, and strangers get 403. **Actual:** a stranger got 200 with `pickupCode`, `deliveryCode` and `recipientEmail`. Nearby lists every pending parcel's codes. The driver sees `deliveryCode` and can complete and get paid with no recipient. The core fraud protection is void. | Add a participant check to `getById`. Build role-specific projections: strip both codes from nearby/driver views, show `pickupCode` only to the sender and `deliveryCode` only to sender/recipient. Add a regression test. |
| C2 | **`reject` works in any state → refund after payout** | `server/src/services/delivery.ts:817-830` | Full lifecycle to `delivered` (payout recorded 45.50, `captured`) → sender `PATCH /deliveries/:id/reject` → 200, status `pending`, `driverId=null` → sender `PATCH /status {cancelled}` → `paymentStatus=refunded`, `refundedCHF=50`. The same works on `in_transit` (parcel in the car, driver unassigned). | **Expected:** reject only from `requested`. **Actual:** any state. The sender gets the item **and** a full refund. In Stripe mode `voidOnCancel` reverses the driver's transfer. Driver earnings went 45.50 → 0. | Guard with `status = 'requested'` in both the check and the `UPDATE … WHERE`. Also never refund `captured` deliveries from the cancel path (route those to a dispute instead). |
| C3 | **`PATCH /status` bypasses both codes** | `shared/src/constants/delivery-status.ts:32-34` + `server/src/services/delivery.ts:166-209` | Matched delivery → driver `PATCH /status` with `accepted`, then `picked_up`, `in_transit`, `delivered`: all 200. | **Expected:** `picked_up`/`in_transit`/`delivered` reachable only through `verify-pickup`/`verify-delivery`. **Actual:** delivered with no code. The payout is skipped silently (`authorised`, no split), so the delivery is stuck: no payout and no refund path. The **sender** can also move `matched→accepted` on the driver's behalf. | Restrict the generic endpoint to `cancelled` (plus `accepted` by the driver only). Remove `picked_up/in_transit/delivered` from `updateDeliveryStatusSchema`. |
| C4 | **Simulated TWINT "pay" endpoint is live in real-payment mode** *(code review, not executed)* | `server/src/routes/payment.ts:10` → `server/src/services/payment.ts:184-196` | With `STRIPE_SECRET_KEY` set, sender calls `POST /payments/twint/pay {deliveryRequestId}`. | **Expected:** 404/400 when Stripe/Payrexx is configured. **Actual:** sets `paymentStatus='authorised'` with no money. At delivery, `captureAndPayoutOnDelivered` transfers to the driver against the platform balance (no `latest_charge` → `transfer_group` branch). The platform pays the driver out of its own pocket. | `if (stripeConfigured() \|\| payrexxConfigured()) throw 404` in the controller, as `devVerifyAll` already does. |
| C5 | **Unpaid deliveries can be listed, claimed and delivered; driver is told the payout succeeded** | `server/src/services/delivery.ts:233` (nearby only filters `status`), `:544` (assign), `server/src/services/payment.ts:208` | Create a delivery without paying → driver sees it in nearby → assign → confirm → pickup → deliver. | **Expected:** only `paymentStatus='authorised'` deliveries are visible or claimable. **Actual:** delivered with `paymentStatus=unpaid` and response `payout: {ok:true}`, so the driver works for free. | Filter nearby/assign/offer on `paymentStatus='authorised'`. Return `payout.ok=false, reason:'unpaid'` from the silent return. |

### High

| # | Title | File:line | Repro | Expected vs actual | Suggested fix |
|---|---|---|---|---|---|
| H1 | **Anyone can self-promote to `admin`** | `server/src/services/user.ts:34-40` (validates against the full Prisma enum incl. `admin`), `server/src/middleware/auth.ts` (`requireRole` lets admin through everything) | `PATCH /users/profile {"role":"admin"}` → 200, `role: admin`. | **Expected:** 400. **Actual:** promoted (takes effect at the next login/refresh). | Allow-list `sender/driver/both/recipient` only. |
| H2 | **No ID-verification gating anywhere** | `server/src/routes/route.ts`, `routes/delivery.ts` (no check of `verificationStatus`/`idVerified`), app has none either | A fresh driver with `verificationStatus=unverified` publishes routes, claims, picks up and gets paid. | **Expected (per brief):** Stripe Identity verified before driving. **Actual:** never checked. | Add a `requireVerified` middleware on route create, assign, offer/accept and verify-pickup. Add an app gate with a CTA to verification. |
| H3 | **Sender can claim and deliver their own parcel; size and weight limits not enforced on claim** | `server/src/services/delivery.ts:544-569`, `routes/delivery.ts:14` (no `requireRole`) | (a) A `both` user assigns own delivery → confirm → codes → delivered, payout 45.50 to self. A `sender`-only role can call `/assign` too. (b) S-vehicle driver claims an **XL** by id → 200. A 100 kg-capacity driver claims a **500 kg** parcel → 200. | **Expected:** `driverId ≠ senderId`, role driver/both, size ≤ vehicle, weight ≤ maxLoad (as `offerToRoute` already checks). **Actual:** all accepted. Self-dealing also inflates CO₂ and delivery stats. | Copy the guards from `offerToRoute` into `assignDelivery`. Add `requireRole('driver')`. |
| H4 | **Cancellation rules: anyone involved can cancel at any state with a full refund, even mid-transit** | `shared/src/constants/delivery-status.ts:30-34`, `server/src/services/delivery.ts:179-207` | Recipient `PATCH /status cancelled` while `in_transit` → 200, sender refunded 20.00. The offered driver cancels the **whole delivery** instead of declining → `cancelled`. Cancel without `cancelReason` stores `cancelledBy=null` (`controllers/delivery.ts:71-77`). | **Expected:** recipient cannot cancel. Driver "cancel" = decline/unassign back to pool. After pickup, no automatic refund (dispute or return flow). Always record the canceller. **Actual:** see repro. Cancel at pending/requested/offered/matched/accepted/in_transit all → `refunded 33.35`. | A per-role, per-state cancel matrix. Always set `cancelledBy = actor`. In-transit cancel → `disputed` state. |
| H5 | **Ratings and disputes are not implemented** | No routes. `Rating` model exists (`prisma/schema.prisma:222`); `shared/src/schemas/rating.ts` unused server-side | `grep` for rating/dispute routes finds none. `averageRating` stays N/A forever. | **Expected (brief):** rate after delivery; dispute a bad handover. **Actual:** missing. GO_LIVE.md also lists "no process for a parcel that arrives broken". | `POST /deliveries/:id/rating` (participants, delivered only, once) and a minimal `disputed` status + admin/email hand-off. |
| H6 | **No expiry: stale deliveries and routes live forever** | `server/src/services/delivery.ts:233` (nearby has no window filter), no job anywhere (`grep expired` → none); `services/route.ts` create has no past check | A delivery with window 2020-01-01..02 is created (201) and shows in nearby. A route departing 2020 is accepted (201). Search does hide past routes. `in_transit` never times out (also noted in GO_LIVE.md). | **Expected:** `deliveryWindowEnd < now` → `expired` + void the hold, and not listed. **Actual:** listed forever; money held forever. | Validate the window on create (`start < end`, `end > now`). Filter nearby on `deliveryWindowEnd > now()`. Run a periodic job that expires and voids. |
| H7 | **Handover-code brute force: no attempt limit; codes from `Math.random`** | `server/src/services/delivery.ts:619-676`, `server/src/utils/apiResponse.ts:15` | 30 wrong pickup codes in a row → all plain 400, no lockout. Only the global 100 req/min/IP limiter applies. | **Expected:** lock after ~5 wrong tries per delivery; codes from a CSPRNG. **Actual:** unlimited (a few hours per IP for 10⁶ codes; less once C1 is fixed and guessing is the only route). | Per-delivery failed-attempt counter + lockout/notify. Use `crypto.randomInt`. |

### Medium

| # | Title | File:line | Repro | Expected vs actual | Suggested fix |
|---|---|---|---|---|---|
| M1 | Delivery-input validation gaps | `shared/src/schemas/delivery.ts:13-30` | Accepted (201): budget **0.01**, **12.34**, **1e9**, **6000** (> TWINT 5000 cap); weight **9999 kg on size S**; declaredValue **1e12**; window **end before start**; window in **2020**; pickup **= delivery**; pickup at **(0,0)** (outside CH); recipient = sender self. Rejected correctly: negative budget, weight 0, negative value. | Should reject. Note: a CHF 1.00 delivery completed with fee 1.00 / **payout 0.00** (sim mode says ok; Stripe mode throws at transfer). | `budgetCHF` min ≈ 5 (above the fee floor), max 5000, `multipleOf(0.05)`. Weight ≤ size max (S 5 / M 15 / L 30 / XL cap). Value cap. `refine(start<end && end>now)`. CH bounding box. |
| M2 | CHF amounts not on the 0.05 grid | `shared/src/constants/pricing.ts:289-306` | Budget 12.34 → fee 1.50, payout **10.84**. Budget 33.35 → fee 3.00 / payout 30.35 (ok by luck). | TWINT/Swiss convention: Rappen rounding to 0.05 for displayed and paid amounts. Currently cent-precise. | Enforce `multipleOf(0.05)` on budget and round the fee to 0.05 (payout = budget − fee keeps it on the grid). |
| M3 | Account deletion → 500 for anyone with deliveries | `server/src/services/user.ts:50-51` | `DELETE /users/account` as a sender with deliveries → 500 "Foreign key constraint violated". | Expected: anonymise or soft-delete (also a revDSG/GDPR right). | Soft-delete + anonymise PII; block while a delivery is active. |
| M4 | Email is case-sensitive (duplicate accounts, failed logins) | `server/src/services/auth.ts:9,49` | Register `QA-SENDER-…@EXAMPLE.COM` after the lower-case one → 201 (second account). Login with upper-case email → 401. `createDelivery` lowercases `recipientEmail`, so a mixed-case registered recipient is never linked by `recipientId`. | Expected: one account per mailbox. | Lowercase and trim on register/login. Migrate existing rows and add a unique index on `lower(email)`. |
| M5 | Unvalidated profile fields → 500 or garbage | `server/src/controllers/user.ts` updateProfile | `{maxLoadKg:-50, vehicleSize:'HUGE'}` → **500** with Prisma internals in dev. `{language:'klingon'}` → 200, stored. | Expected: 400 with zod. | Use a zod `updateProfileSchema` (the shared package already has the shapes). |
| M6 | Chat input not validated | `server/src/controllers/chat.ts:41` | `POST /chat/:id/messages {}` → **500**. 200 kB content → 500 (body limit). | Expected 400 (empty) / 413 or 400 (too long); cap at e.g. 2000 chars. | zod schema `content: z.string().trim().min(1).max(2000)`. |
| M7 | Italian is a 2nd-class language | `shared/src/schemas/auth.ts:10` (`'en'\|'de'\|'fr'`), `app/src/screens/auth/RegisterScreen.tsx:78-80` | `register {language:'it'}` → 400. The app maps `it` → `en`, so Ticino users get **English** emails although `email.ts` has IT templates. Profile update accepts any string. | Expected de/fr/it/en everywhere. | Add `'it'` to the enum and the app mapping. Validate `language` on profile update. |
| M8 | Hard-coded English UI strings (preflight parity check misses them) | `app/src/screens/auth/LoginScreen.tsx:53,55`; `app/src/screens/shared/HomeScreen.tsx:195-196`; `app/src/screens/sender/MyShipmentsScreen.tsx:234`; Create-request stepper "Package / Address / Budget", "Shipping from a marketplace?", "Auto-fill" | Playwright in de-CH/fr-CH/it-CH: hero, impact card, "My shipments" and the stepper are English in all locales. Screenshots: `qa-shots/de-01-login-hero-hardcoded-english.png`, `de-02-…`, `de-10-create-request-english-stepper.png`. | Expected: localized. Also "CO₂ saved **this year**" shows the lifetime `co2Saved`. | Move to i18n keys. Extend preflight with a lint for JSX string literals. |
| M9 | `confirm` / pickup / delivery updates are not atomic | `server/src/services/delivery.ts:581-584, 627-630, 678-681` | A concurrent double handover was serialized correctly by luck of timing in my run (200 + 400). But the `UPDATE`s have no `AND status=…` guard (unlike assign/offer), and co2/totalDeliveries increments follow unconditionally. | Expected: compare-and-swap like `assignDelivery`. | Add `AND status = '<expected>'` and check the row count before the side effects. |
| M10 | App typecheck red (CI) | `app/ShowcaseRoot.tsx:20-21` | `npm run typecheck` | Expected green. | Add both font packages to `app/package.json`, or exclude `ShowcaseRoot.tsx` from tsconfig. |

### Low

| # | Title | File:line | Notes / fix |
|---|---|---|---|
| L1 | Datetime with offset rejected | `shared/src/schemas/delivery.ts:28-29`, `route.ts` | `2026-11-03T09:00:00+01:00` → 400 "Invalid datetime" (`z.string().datetime()` without `{offset:true}`). The app sends `toISOString()` (Z) so it works today, but partners and the widget will trip on it. |
| L2 | Time-zone handling relies on the device tz | `shared/src/constants/timing.ts:63-89` (`windowFor` uses local `getFullYear/getDate`), app `toLocale*(undefined, …)` without `timeZone` | A sender whose device is not on Zurich time (traveller, web user abroad) books a "tomorrow" window in their own tz, and times render in device tz and locale rather than the app language. Pass `timeZone:'Europe/Zurich'` and `i18n.language`. Route departure round-trips correctly in UTC (verified). |
| L3 | Bottom tab labels clipped on web (390 px) | `qa-shots/de-02-home-tabbar-labels-clipped-and-english-impact-card.png` | Labels sit below the visible bar. Check tab-bar height/safe-area on web. |
| L4 | `PATCH /routes/:id/active` with an empty body → 200 | `server/src/controllers/route.ts` toggleActive | `isActive` undefined is passed to Prisma (no-op). Validate a boolean. |
| L5 | Recurring route with no `recurringDays`, and `availableSize` larger than the vehicle (XL on an L car) both accepted | `shared/src/schemas/route.ts` | Refine: recurring ⇒ ≥1 day; size ≤ `user.vehicleSize`. |
| L6 | CO₂ detour uses *any* active route of the driver | `server/src/services/delivery.ts:707-719` | Use `offeredRouteId` or the route actually matched; store `routeId` on the delivery. |
| L7 | `charge.refunded` webhook marks partial refunds as `refunded` | `server/src/services/payment.ts` handleStripeEvent | Use `partially_refunded` when `amount_refunded < amount`. |
| L8 | Mixed-language API errors | throughout (`'Not authorized'` vs `'Nicht möglich: …'`) | Return error codes; let the app translate. |

### Repo hygiene / secrets (not functional, but found during setup; values not reproduced here)

- `packages/server/.env` (untracked) contains, besides the expected keys, a **bare `sk_live_…` Stripe secret line** with no variable name, plus real Resend/Twilio credentials. Rotate the live key and remove it from the file.
- `stripe_backup_code.txt` is **tracked in git** (repo root). It looks like a Stripe 2FA backup code. Remove it from history and regenerate.
- `.env.bak-*` copies with the same secrets sit next to `.env` (gitignored, but they get copied around).
- I moved both env files out of my working copy before booting and ran with a minimal local `.env`. No real key was used.

---

## What I could NOT test, and why

| Area | Reason |
|---|---|
| Real Stripe flows (PaymentIntent, webhook → `authorised`, Connect transfer with `source_transaction`, refunds/reversals in Stripe, Identity sessions) | No test keys allowed/provided. Ran in simulated mode; C4 and the Stripe side of C2 come from code review. |
| `npm run e2e` | Targets the deployed API with real secrets. |
| Payrexx TWINT, Twilio SMS, Resend email delivery | External services; all simulated/no-op locally (dev mode accepts any SMS code). |
| Maestro on-device flows, push notifications, background GPS/live tracking (socket.io) | Needs a simulator/devices; the web build's socket targets prod, which was blocked. |
| Full UI create-request → pay → handover via the browser | Address autocomplete depends on an external geocoder (blocked). I drove the lifecycle via the API instead and used the UI for screen rendering and i18n. |
| Load/concurrency beyond a 2-request race | Time-box. |
| Native Prisma query engine | Engine download blocked. I used the `queryCompiler` + `pg` adapter, which is functionally equivalent for these tests, but raw-SQL timestamp casting could differ slightly from prod. |

## Artifacts
- Screenshots: `/home/claude/shlep/reports/qa-shots/`
- Probe scripts and logs: `/tmp/claude-0/-home-claude/a3e240ea-94ee-5e3c-9a62-a03cddf9fcf9/scratchpad/qa/` (`api.mjs`, `api2.mjs`, `run1.log`, `ui2.cjs`, `ui3.cjs`)
- Harness changes (work-qa only): `packages/server/prisma/schema.prisma` (generator preview features), `packages/server/src/config/database.ts` (pg adapter), `packages/server/package.json` (+`@prisma/adapter-pg`, `pg`), minimal `packages/server/.env`.
