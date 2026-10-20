# Testing

Three layers. Each catches a different class of fault, and each costs a
different amount to run.

| | Command | Needs | Time |
| --- | --- | --- | --- |
| **Static** | `npm run verify:all` | nothing | ~30s |
| **Money, end to end** | `npm run e2e` | two secrets | ~2 min |
| **On device** | `npm run e2e:ui` | a simulator and a dev build | ~5 min |

Layers one and two run automatically on every push to `main`. The third is
manual, because it needs a built app and a simulator.

---

## Why this exists

Getting one payment through by hand took the better part of a week. Every
fault it exposed was a single wrong value, invisible until something several
steps downstream broke:

- a webhook endpoint that existed only in **live** mode, so no test payment was
  ever announced and five deliveries sat `unpaid` with the money taken
- a publishable key from a **different Stripe account** than the secret key
- an onboarding link built with a **custom URL scheme**, which Stripe rejects —
  so no driver could ever have completed payout setup
- transfers drawing on an **available balance that is always empty** at the
  moment a delivery completes, so no driver could ever have been paid

Each is one assertion. Each cost hours because the symptom surfaced far from
the cause. That is the entire argument for the suite.

---

## 1 · Static — `npm run verify:all`

No secrets, no network beyond npm. Runs in CI on every push and pull request.

- **`npm run typecheck`** — server, **server scripts**, and app. The scripts
  were unchecked until October; `tsconfig.json` included only `src`, so a
  syntax error in `payment-trace` shipped past a green typecheck.
- **`node scripts/preflight.mjs`** — config drift: native modules, iOS/Android
  permissions, the production API URL, i18n parity across four languages, the
  waitlist roles matching the API, and that payout happens at exactly one call
  site behind the recipient's code.
- **`npm run contrast`** — all 21 text/background pairs against WCAG AA. The
  brand green sat at 7.94 against paper for months, reading as near-black,
  because it was only ever judged by eye.
- **`node scripts/price-sanity.mjs`** — no size class claims an advantage it
  does not have, and no trip underpays a driver.
- **`node scripts/payment-battle.mjs`** — the fee split under hostile input:
  zero, negative, NaN, Infinity, the fee floor eating the ticket, and 20 000
  random amounts checked for `fee + payout === budget` exactly, in cents.

---

## 2 · Money, end to end — `npm run e2e`

Drives the deployed test-mode API as three real users and checks the result in
Stripe. **No phone involved**: the payment sheet is replaced by confirming the
PaymentIntent server-side with a test card, which exercises every part of the
chain except the pixels.

It touches no database — deliberately, because the database sits behind an IP
allow list a CI runner will never be on.

### Setup, once

```sh
# 1. Generate a password and seed the three accounts
cd packages/server
E2E_PASSWORD="$(openssl rand -base64 24)" npx tsx scripts/seed-e2e-users.ts
```

Keep that password. It goes in `packages/server/.env` and in the repository
secrets, so local runs and CI drive the same accounts.

```sh
# 2. Onboard the e2e driver for payouts — the one step that cannot be scripted
```

Stripe Connect onboarding is a hosted form. Log into the app as
`e2e-driver@shlep.ch`, open payout setup, and complete it with Stripe's test
values: IBAN `CH9300762011623852957`, address line 1 `address_full_match`,
DOB `01/01/1901`. Until that is done the suite reaches the payout step and
stops there — correctly, because an unonboarded driver cannot be paid.

```sh
# 3. Run it
STRIPE_SECRET_KEY=sk_test_... E2E_PASSWORD=... npm run e2e
```

### What it asserts

1. all three accounts can sign in
2. a driver can publish a route
3. a sender can create a delivery, and the server is in real Stripe mode
4. a card payment succeeds
5. **the webhook marks it `authorised`** — the fault that left five deliveries unpaid
6. the delivery is visible to the driver (capacity filters)
7. a wrong pickup code is refused; the right one is accepted
8. a wrong delivery code is refused **and no money moves because of it**
9. the right code captures, with the correct 9% / CHF 1.50 split
10. **Stripe itself** agrees the transfer exists, for the right amount
11. the transfer carries `source_transaction` — without it, every payout fails
    whenever the platform balance is empty, which is always
12. a cancelled paid delivery refunds the sender in full

### Secrets in CI

Repository → Settings → Secrets and variables → Actions:

- `STRIPE_TEST_SECRET_KEY` — a `sk_test_` key for the **same** Stripe account
  the API uses. The suite refuses a live key rather than trusting whoever set it.
- `E2E_PASSWORD` — the value from the seed step.

---

## 3 · On device — `npm run e2e:ui`

[Maestro](https://maestro.mobile.dev) flows in `.maestro/`. These cover what
the API cannot see: whether a person can actually get through the screens, and
whether the Stripe sheet opens rather than failing silently.

```sh
brew install facebook/fb/idb-companion
curl -Ls "https://get.maestro.mobile.dev" | bash

# with a dev build installed on a simulator or device
E2E_EMAIL=e2e-sender@shlep.ch E2E_PASSWORD=... E2E_RECIPIENT=e2e-recipient@shlep.ch \
  npm run e2e:ui
```

Selection is by `testID`, not by visible text — the app ships in four
languages and its copy changes often. When you add a control a flow needs to
touch, give it a `testID`.

Not in CI: it needs a macOS runner and a built app, which is real money per
run for a product still changing shape. Worth revisiting when the UI settles.

---

## What none of this covers

Said plainly, so it is not mistaken for coverage:

- **TWINT specifically.** Flows run on a card. TWINT needs the TWINT app and a
  Swiss phone; it is approved in live mode and still unexercised.
- **Live money.** Everything here is test mode in a sandbox account. The
  sandbox has no live mode at all, so going live is a fresh setup on the
  business account — new keys, new webhook, drivers onboarding again.
- **Disputes.** No path has been run.
- **Concurrency under real load.** The double-capture case is covered by an
  idempotency key in `payment-battle`; two real phones racing is not.
- **Push notifications and live GPS.** Neither is asserted anywhere.
