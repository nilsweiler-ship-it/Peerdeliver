# Shlep — Full-Scale Validation Protocol

*A staged plan to validate that Shlep is correct, safe, and reliable enough to move from prototype → closed launch cohort → public Switzerland-wide scale. Each phase has entry criteria, tests, and explicit go/no-go gates. Owners and dates are left blank for you to assign.*

> **Legal note:** the regulatory items below are planning prompts, not legal advice. Confirm insurance, liability, data-protection, and financial-regulation questions with a Swiss lawyer and your insurer before public launch.

---

## Phase 0 — Readiness (before any external users)

**Entry:** app builds clean, backend deploys to a staging environment.

- [ ] Environments separated: `dev` / `staging` / `prod`, each with its own DB and Stripe keys.
- [ ] Secrets in a manager (not `.env` in git); `JWT_SECRET` / refresh secret rotated to strong random values.
- [ ] Database migrations run cleanly forward on a fresh instance; a restore-from-backup has been tested once.
- [ ] Error monitoring (Sentry or similar) wired on both app and API; crash + unhandled-rejection reporting confirmed.
- [ ] Structured logging on the API with request IDs; no PII (emails, tokens, addresses) in logs.

**Gate 0:** staging is reachable, observable, and reproducible from scratch.

---

## Phase 1 — Functional QA (test matrix)

Run every core flow for each role. Track pass/fail per row.

| # | Flow | Role | Expected result |
|---|---|---|---|
| 1 | Register + email verification | sender / driver / both | Account created, correct role, language persisted |
| 2 | Login / logout / token refresh | all | Session persists; refresh works; logout clears tokens |
| 3 | Create request (3-step wizard) | sender | Package/address/budget saved; appears in My Shipments |
| 4 | Publish recurring route | driver | Route with days/time/capacity/detour saved & listed |
| 5 | Browse & request available delivery | driver | Geo-radius list correct; request creates a match |
| 6 | Accept / decline driver (Action Needed) | sender | Accept → matched; decline → back to pool |
| 7 | Pickup code verification | driver | Correct code → picked_up; wrong code rejected |
| 8 | Delivery code verification | driver | Correct code → delivered + celebration; wrong code rejected |
| 9 | Live location tracking | both | Driver location streams to sender within ~10s |
| 10 | Chat (send/receive, quick replies, read receipts) | both | Messages deliver in real time, scoped to shipment |
| 11 | Ratings after delivery | sender/recipient | Rating recorded against driver (not self) |
| 12 | Earnings & payout view | driver | Pending balance, per-delivery split (91/9, min. fee CHF 1.50), statuses |
| 13 | Role switch (sender ↔ driver ↔ both) | all | Tabs/permissions update immediately |
| 14 | Cancellations / expiry | all | Status + payment handled correctly (see Phase 2) |

**Negative & edge cases:** expired request, double-accept race, wrong code 3× (lockout?), offline mid-delivery, backgrounded app during tracking, very long addresses, duplicate submits, timezone/DST on route times.

**Gate 1:** 100% of rows 1–13 pass; no P0/P1 defects open.

---

## Phase 2 — Payments validation (highest-risk area)

Use Stripe **test mode** end-to-end, then a small set of **real low-value** transactions before launch.

- [ ] **Escrow flow:** payment authorised on match, **captured only on verified delivery**; platform fee = 9% with CHF 1.50 minimum, remainder to driver (matches `computeSplit` incl. `PLATFORM_FEE_MIN_CHF`).
- [ ] **TWINT** happy path completes and settles; **card** happy path completes.
- [ ] **Failure paths:** declined card, insufficient funds, abandoned TWINT redirect, expired authorization — each leaves delivery + payment in a consistent state (no "delivered but unpaid" or "paid but undelivered").
- [ ] **Cancellations/refunds:** sender cancels pre-pickup → authorization voided; cancel post-pickup → refund policy applied; failed delivery → refund.
- [ ] **Stripe Connect:** driver onboarding (KYC) completes; payouts land; **per-active-account monthly fee** accounted for.
- [ ] **Webhooks:** `payment_intent.*`, `charge.refunded`, `account.updated` handled idempotently (replay a webhook twice → no double payout).
- [ ] **Reconciliation:** platform ledger matches Stripe dashboard for a test day.
- [ ] **Fee/margin check:** confirm the TWINT-vs-card margin difference (see cost summary) is visible in reporting so you can steer method mix.

**Gate 2:** no state where money and delivery status disagree; webhooks idempotent; reconciliation balances.

---

## Phase 3 — Security & data protection

- [ ] AuthZ: a user cannot read/modify another user's deliveries, chats, routes, or payment data (test with two accounts + forged IDs).
- [ ] Rate limiting active on auth, code-verification, and messaging endpoints (brute-force on 6-digit codes is the key risk — enforce attempt limits + backoff).
- [ ] Input validation (Zod) on every endpoint; reject malformed/oversized payloads.
- [ ] Transport: TLS everywhere; secure token storage on device (`expo-secure-store`).
- [ ] **Swiss/EU data protection (revised FADP + GDPR):** privacy policy, consent, data-subject export/delete, documented retention. Location data and addresses are sensitive — minimise and expire them.
- [ ] Dependency scan (npm audit / Snyk) clean of criticals; secrets scan on the repo.
- [ ] Third-party pen-test or at least an OWASP Mobile/API Top-10 self-review before public launch.

**Gate 3:** no critical/high vulns open; cross-account access impossible; code-guessing rate-limited.

---

## Phase 4 — Reliability, performance & load

Set targets, then test against them on staging.

| Metric | Target (launch) | Target (scale) |
|---|---|---|
| API p95 latency (reads) | < 300 ms | < 300 ms |
| API p95 latency (writes) | < 600 ms | < 600 ms |
| Location update → sender visible | < 10 s | < 5 s |
| Concurrent tracked deliveries | 50 | 5,000 |
| Concurrent socket connections | 200 | 20,000 |
| Crash-free sessions | > 99.5% | > 99.8% |
| API uptime | 99.5% | 99.9% |

- [ ] Load test the API + Socket.io at target concurrency (k6/Artillery); watch DB connections, event-loop lag, memory.
- [ ] Verify horizontal scaling path for Socket.io (sticky sessions or a Redis adapter) **before** you need it.
- [ ] DB: add/verify indexes on hot queries (geo-radius search, deliveries by user/status, messages by shipment); test with a seeded large dataset.
- [ ] Graceful degradation: what happens if Stripe, the DB, or sockets are briefly down?

**Gate 4:** targets met at launch concurrency with headroom; a documented plan (not necessarily built) for nationwide-scale concurrency.

---

## Phase 5 — Device, accessibility & localization

- [ ] Device matrix: iOS (latest + 2 prior major), Android (latest + 2 prior); small (iPhone SE) and large screens; notch + home-indicator safe areas on every screen.
- [ ] Accessibility: contrast passes WCAG AA (caption token fixed to 4.6:1); test with OS large text; VoiceOver/TalkBack labels on interactive elements and the code-entry boxes.
- [ ] Localization: full **de / fr / en** coverage (Swiss market); no clipped strings; CHF/number/date formats correct per locale.

**Gate 5:** no layout breakage or unreadable text across the matrix; all three languages complete.

---

## Phase 6 — Trust, safety & operations

- [ ] Code-verified handoff cannot be bypassed; lost-code recovery path exists.
- [ ] Dispute/complaint flow defined (item damaged/lost, no-show, wrong item) with who pays and how.
- [ ] **Insurance & liability:** parcel-loss/damage cover and driver/personal-injury liability confirmed with an insurer; terms surfaced to users. This is a launch blocker for a physical-goods marketplace.
- [ ] Prohibited-items policy (no illegal/hazardous goods) shown at request creation.
- [ ] Support channel + response SLA; incident runbook (payment outage, data incident, safety report) with on-call.
- [ ] Backups: automated daily DB backup + tested restore; retention defined.

**Gate 6:** insurance in place; dispute + incident runbooks exist; backups tested.

---

## Phase 7 — Closed launch cohort, Switzerland-wide (the real validation)

**Design:** Switzerland-wide from day one, but as a **closed cohort concentrated on 3–5 dense corridors across regions** (e.g. Zürich–Winterthur, Bern–Thun, Genf–Lausanne, Basel–Liestal) so liquidity forms instead of spreading thin. Seed supply first (recruit founding drivers with recurring routes), then invite senders. Instrument everything.

**Success metrics & thresholds:**

| Metric | Why it matters | Launch target |
|---|---|---|
| Match rate (requests matched) | Liquidity | ≥ 70% |
| Time-to-match | Marketplace health | median < 2 h |
| On-time, code-verified delivery rate | Reliability & trust | ≥ 95% |
| Failed/disputed delivery rate | Safety | < 2% |
| Driver payout success rate | Payments work | ≥ 99% |
| Sender repeat rate (30-day) | Real demand | ≥ 30% |
| Driver repeat rate (30-day) | Real supply | ≥ 40% |
| Avg rating | Quality | ≥ 4.5 / 5 |
| Crash-free sessions | Stability | ≥ 99.5% |
| CAC (informal) & TWINT share | Economics | tracked; TWINT ≥ 50% |

- [ ] Analytics instrumented for each metric above (event tracking) before launch.
- [ ] Weekly review cadence; qualitative interviews with ≥ 5 senders and ≥ 5 drivers.

---

## Go / No-Go: scaling gate

**Open the cohort to the public only if ALL are true:**

1. Gates 0–6 passed; no open P0/P1 defects.
2. Launch cohort hit match rate ≥ 70%, verified-delivery ≥ 95%, dispute rate < 2%.
3. Repeat rates clear thresholds (senders ≥ 30%, drivers ≥ 40%) — evidence of real, recurring demand *and* supply.
4. Payments reconciled cleanly for the full launch period; zero money/status mismatches.
5. Insurance, data-protection, and prohibited-items policies live.
6. Load targets met with headroom and a documented horizontal-scale plan.

**If any fail:** iterate within the closed cohort rather than opening up — scaling a leaky funnel multiplies the leak.

---

## Suggested sequence & rough effort

1. Phases 0–1 (readiness + functional QA) — foundational, do first.
2. Phase 2 (payments) — highest risk; overlaps with 0–1.
3. Phases 3–5 (security, load, device/a11y/l10n) — before external users.
4. Phase 6 (trust/insurance/ops) — insurance lead time can be long; **start early**.
5. Phase 7 (closed launch) — the decisive validation; everything else exists to make this trustworthy.
