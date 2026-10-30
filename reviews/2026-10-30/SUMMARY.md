# Shlep pre-MVP battle test: consolidated findings

**Date:** 30 Oct 2026 · **Build:** `main` @ `6c0f3db` (+2 local commits)
**Four independent reviews:** functional QA (`qa.md`), security (`security.md`), stress/concurrency (`stress.md`), legal/regulatory (`legal.md`). Full detail, file:line references and repro steps are in each report. This page removes duplicates and ranks what to fix.

## Verdict: not MVP-ready, but no redesign is needed

The happy path works end to end: sign-up, route, request, claim, both codes, the 9 % / CHF 1.50 split, earnings and chat. Several things are solid already. 30 drivers claiming the same parcel at once produce exactly one winner. SQL is parameterised throughout. Stripe webhooks verify signatures, and Stripe calls carry idempotency keys. Passwords are hashed with bcrypt (12 rounds). The CO₂ model is conservative and sourced.

The **trust and money layer** is the problem. Shlep's whole promise is that the driver only gets paid when the recipient's code proves the handover happened, and right now there are several ways around that. Every issue below can be fixed in existing code. Estimate: **about 3–4 focused days of server work for P0 + P1**, plus copy changes and two or three counsel opinions.

**Testing limits.** No real Stripe, SMS or email ran: all tests used simulated payment mode and no real keys. In the sandbox, Prisma's engine download was blocked. QA worked around this and ran the API live. The security review was static plus logic tests. The stress test ran its races directly against Postgres, and the HTTP load test (throughput and latency numbers) is still outstanding.

---

## P0: fix before any real money moves

| # | Issue | Found by | Where | Fix |
|---|---|---|---|---|
| 1 | **Handover codes leak.** `pickupCode`/`deliveryCode` come back in `/deliveries/mine`, `/deliveries/:id` and `/deliveries/nearby`. The driver reads the delivery code and confirms "delivered" with no recipient, and gets paid. | QA, Security | `services/delivery.ts:12-25` | Remove both codes from every read projection. The pickup code goes only to the sender, the delivery code only to sender and recipient, through their own channel. |
| 2 | **IDOR.** `GET /deliveries/:id` has no participant check. Any account can read any delivery's addresses, recipient phone and email, Stripe references and codes. | QA, Security | `controllers/delivery.ts:58` | Return 403 unless the caller is sender, driver or recipient (reuse `isDeliveryParticipant`). |
| 3 | **Refunds after a good delivery.** (a) `reject` works in any state, so a sender can reject a delivered parcel and then cancel for a full refund, and the driver's transfer is reversed. (b) A cancel that races with verify-delivery refunds anyway, because its row count is ignored. Reproduced: `delivered` + driver paid CHF 45.50 + sender refunded CHF 50. (c) Anyone involved, including the recipient, can cancel mid-transit for a full refund. | QA, Stress | `services/delivery.ts:817`, `:195-207`; `payment.ts:315` | Reject only from `requested`. Act on the cancel's affected-row count. `voidOnCancel` refunds only from `authorised`. Add a per-role, per-state cancel matrix, so a cancel after pickup becomes `disputed`, not a refund. |
| 4 | **`PATCH /status` skips both codes.** It can jump straight to picked up or delivered. | QA | `shared/.../delivery-status.ts:32`, `services/delivery.ts:166` | The generic endpoint allows only `cancelled` (and `accepted` by the driver). |
| 5 | **Payment is never required.** Unpaid deliveries can be listed, claimed and completed, and the driver is told "payout ok". The simulated TWINT "pay" endpoint stays live when real Stripe is configured, so a sender can mark an order paid without paying. | QA | `services/delivery.ts:233,544`; `routes/payment.ts:10` | Show and allow claims only when `paymentStatus='authorised'`. Return 404 on the sim endpoint when a real provider is configured. |
| 6 | **Handover steps aren't atomic.** 10 simultaneous verify-delivery calls gave the driver 10 completed deliveries, 10× the CO₂, and 5 capture writes. Stripe idempotency stops a double payout, but nothing in the app does. | Stress, QA | `confirmDelivery:582`, `verifyPickup:628`, `verifyDelivery:679`, `rejectDriver:825` | `UPDATE … WHERE status=<expected>`, check the row count, and wrap the status change, stats and capture in one `$transaction`, the same pattern the claim path already uses. |
| 7 | **Anyone can make themselves admin.** `PATCH /users/profile {"role":"admin"}`, then refresh, gives an admin JWT. | QA, Security | `services/user.ts:33`, `controllers/user.ts:16` | Stop accepting `role` in profile updates. |
| 8 | **Secrets.** `stripe_backup_code.txt` is committed **and pushed to GitHub** (`origin/main`, since `fda3255`). `packages/server/.env` has a bare `sk_live_…` line. | Security, QA | repo root, server `.env` | **Regenerate the Stripe backup codes and roll the live secret key now.** Then purge the file from git history and remove the stray line. |

## P1: before the first pilot users

- **ID verification is never enforced.** Claiming, accepting and pickup check only payout onboarding, never `idVerified`. The dev endpoints `dev-verify-all` and `dev-complete` stay live because `NODE_ENV` defaults to `development`. (Security M-5/M-6, QA H2)
- **Self-dealing and capacity.** A user can claim their own parcel and pay themselves. `assignDelivery` skips the size and weight checks that `offerToRoute` does. (QA H3)
- **Code brute force.** Codes come from `Math.random()`, with no per-delivery lockout. Switch to `crypto.randomInt` and lock after about 5 failed attempts. (Security M-7, QA H7)
- **Nothing expires.** Stale requests stay listed forever, and an abandoned `in_transit` delivery holds the sender's money indefinitely. Needs window validation, a nearby filter and an expiry/void job. (QA H6, Legal M3)
- **No ratings or disputes,** although both are MVP features and the schema already has a `Rating` model. Disputes are also the landing state for #3. (QA H5, Legal M2)
- **Input validation.** Budgets of CHF 0.01, 1e9 or above the 5,000 TWINT cap are accepted. So are 9,999 kg on size S, a window that ends before it starts, pickup equal to drop-off, and (0,0). Amounts aren't on the 0.05 Rappen grid. (QA M1/M2)
- **CI is red.** The app typecheck fails because `ShowcaseRoot.tsx` imports two font packages missing from `app/package.json`. (QA M10)

## Legal: before public launch (not legal advice; for Swiss counsel)

| Priority | Item | Action |
|---|---|---|
| **Showstopper, free fix** | The website says drivers are *"verifiziert / Ausweis geprüft von Stripe"* while ID checks are still simulated (`idVerified = true`). Your own `STRIPE_ACTIVATION.md §6` says not to claim this. UWG risk. | Soften the copy until Stripe Identity is live. Show the badge only when the webhook sets `idVerified`. |
| **Showstopper, needs an opinion** | "Variante A" keeps the sender's money in Shlep's Stripe balance until the code is confirmed. That may count as financial intermediation under GwG **from the first delivery**, not only once the volume thresholds are reached. | Written GwG/FINMA opinion **before the first paid delivery**. Ask whether Variante C (card authorisation + manual capture) should be the default. |
| High | Recipients (non-users) get texts but never see a privacy notice (nFADP Art. 19 / GDPR Art. 14). The privacy policy doesn't name sub-processors, international transfers or the Stripe Identity biometric data. | Data-protection lawyer finalises the policy. Add a privacy link to the recipient SMS. |
| High, opinions | Drivers could be classified as employees (AHV; cf. Uber CH). Private car insurance usually excludes paid carriage. Prohibited goods move unseen. | Employment/social-security opinion. Insurance broker. Mandatory insurance acknowledgement for drivers and a prohibited-items acknowledgement for senders. |
| Quick fix | The ToS + privacy checkbox is **pre-ticked** (`RegisterScreen.tsx:63`). | Default it to unchecked. |
| Quick fix | The site calls a TWINT payment "reserviert", but TWINT charges immediately. | Describe each payment method accurately. |

Suggested counsel line-up and the full list are in `legal.md`.

## P2: early pilot / scale

- **Performance.** No GiST index on the driver "nearby" query: a full scan on every poll, about 5× faster with the index. List endpoints aren't paginated, there's no index on `LOWER(recipientEmail)`, and the Prisma pool size isn't configured. The rate limiter is per-IP and in-memory, so NAT'd users share one bucket and the login throttle can be spoofed via `X-Forwarded-For`. (Stress H2, M1–M4)
- **i18n.** Italian is rejected at registration and mapped to English. The hero, impact card, "My shipments" and the create stepper are hard-coded in English. The impact card says "this year" but shows the lifetime figure. (QA M7/M8)
- **Correctness.** Account deletion returns 500 for anyone with deliveries, which is also a data-protection deletion-right issue. Email is case-sensitive, so duplicate accounts are possible. Profile and chat input is unvalidated and can cause 500s. (QA M3–M6)
- **Hardening.** Add `helmet`, a CORS allowlist, a JWT `algorithms` pin, a JWT secret of at least 32 characters, and a generic 500 message by default. Accept datetimes with an offset, use the Zurich timezone explicitly, and fix the tab labels clipped on web. (Security L-8…L-12, QA L1–L8)

## Recommended next step

1. **You, today:** regenerate the Stripe backup codes and roll the live secret key (P0 #8). Soften the "verifiziert" website copy.
2. **Me, next:** fix P0 #1–7 on a branch with regression tests for each repro. Then re-run the QA and stress harnesses against the fixed build.
3. **Book** the GwG opinion before any paid delivery.
