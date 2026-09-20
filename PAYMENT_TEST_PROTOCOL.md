# Payment test protocol

Companion to `STRIPE_ACTIVATION.md`. That one gets the account ready; this one
proves the money moves.

---

## First, a correction to the plan

> "I have two Twint accounts so should be possible to send back and forth"

It isn't — not because of the accounts, but because TWINT only runs in one
direction here.

**TWINT is pay-in only.** A sender approves a TWINT payment and the money lands
in the Shlep platform balance. The driver is paid by **Stripe Connect Express,
which pays out to a bank account (IBAN)** — there is no TWINT payout rail. So
the loop is not TWINT → TWINT. It is:

```
TWINT (sender)  →  Shlep platform balance  →  transfer  →  driver's Stripe
                                                            balance
                                                                 ↓
                                                        payout to IBAN
```

Consequences for your test:

- **One TWINT account is enough.** It plays the sender.
- **The driver needs an IBAN, not TWINT.** Your own account is fine — the money
  makes a round trip back to you, minus Stripe's cut.
- **The second TWINT account is still worth using once**, in Phase 2, to confirm
  a payment from a phone that is not the one running the app. TWINT refuses to
  send money to the same number it is sending from, and that restriction is
  what made the earlier in-app test look broken when it was not.

The driver's side is also where the wait is: a transfer reaches the connected
account immediately, but the payout to the bank follows the schedule Stripe
sets for the account. Check **Balance → Payouts** in the Express dashboard for
the actual date rather than assuming same-day.

---

## Before you start: three things were missing

Checking whether this protocol could be run turned up the reason it could not.
All three are fixed in the working tree but **need a new dev build** — none of
them is a JS change that reloads over the air.

| What was missing | Effect if you had tried |
| --- | --- |
| `stripePublishableKey` was `""` in `app.json` | `StripeProvider` mounted with no key. `initPaymentSheet` fails on the first call — the TWINT sheet never opens. |
| No `@stripe/stripe-react-native` config plugin | The native SDK was in `package.json` but its URL scheme was never registered. TWINT hands off and cannot hand back. |
| No `returnURL` on `initPaymentSheet` | Same failure from the other side: the payment succeeds in TWINT and the app sits waiting, which reads as a failure the sender is inclined to repeat. |

A fourth, server-side, is fixed and only needs a redeploy: `payment_intent.succeeded`
never called `announceToRecipient`. The simulated path and the Payrexx path
both did; the real Stripe path did not. A live TWINT payment would have told
the recipient nothing at all.

---

## Phase 0 — No money, no app, no TWINT

Two commands. Run them first every time; they are fast and they fail loudly.

```bash
npm run payment:battle     # arithmetic + hostile money paths
npm run stripe:test        # one happy path, authorise → transfer
```

`payment:battle` runs its arithmetic suite with no Stripe access at all. To get
the money-path suite too, `stripe login` once, or export a `sk_test_` key.

**Pass condition:** `0 failed`. Note that *skipped is not passed* — the script
says so itself, and a run reporting `7 passed, 1 skipped` has verified the
arithmetic and none of the money paths.

---

## Phase 1 — Test mode, whole app, still no real money

This is the phase that matters. It exercises the complete chain — app → server
→ Stripe → webhook → capture → transfer — and it needs no TWINT app, because
in test mode Stripe serves its own redirect page with **Authorize test payment**
and **Fail test payment** buttons.

### Setup

1. **Server on test keys.** In Render → Environment, set `STRIPE_SECRET_KEY` to
   the `sk_test_…` key. Redeploy.

2. **Webhook.** Stripe Dashboard → Developers → Webhooks → add endpoint
   `https://api.shlep.ch/webhooks/stripe`, events:
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `charge.refunded`, `account.updated`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET` and redeploy.

   Without this the payment succeeds at Stripe and the delivery stays `unpaid`
   forever. It is the single most likely thing to be wrong.

3. **App build with the publishable key.**

   ```bash
   cd packages/app
   EXPO_PUBLIC_STRIPE_PK=pk_test_... npx eas build --profile development --platform ios
   ```

   Expo Go cannot do this — the Stripe native module is not in it. The app
   falls back to simulated TWINT there, which tests nothing about Stripe.

4. **Driver onboarding.** Log in as the driver account, open payout setup,
   complete the Express form. In test mode use Stripe's test values: any DOB,
   address `address_full_match`, IBAN `CH9300762011623852957`, and skip the ID
   upload where offered.

   Then confirm it took:

   ```bash
   npm run payment:trace
   ```

   The driver line must read `driver payouts enabled`. If it says `NOT enabled`,
   nothing later in this protocol will work — the transfer is refused and the
   delivery stops at `authorised`.

### The run

Use three accounts you already have: `+shlep-sender`, `+shlep-driver`,
`+shlep-recipient`.

| # | Do this | Expected in the app | Confirm it with |
| --- | --- | --- | --- |
| 1 | Driver publishes a route, e.g. Pfungen → Schaffhausen | Route listed under My Routes | — |
| 2 | Sender creates a delivery on that corridor, CHF 25, size M | The matching driver appears | — |
| 3 | Sender confirms → the payment sheet opens | TWINT listed as a method | If the sheet does not open, the build has no publishable key |
| 4 | Choose TWINT → Stripe's test page → **Authorize test payment** | Returns to the app; "created" confirmation | `payment:trace` → `payment authorised` |
| 5 | — | Recipient receives the announcement email | Check the inbox. This is the fix above; if nothing arrives, the webhook is not wired |
| 6 | Driver accepts the delivery | Appears under Active | `payment:trace` → still `authorised` |
| 7 | Driver marks picked up | Status `picked_up`; sender and recipient both get the code | The code is also in `payment:trace <id>` |
| 8 | Driver enters the **wrong** code | Rejected | `payment:trace` → still `authorised`, no transfer. **This is the test that matters** — money must not move on a failed code |
| 9 | Driver enters the right code | "Delivered", CO₂ shown | `payment:trace` → `captured`, and a `transfer` id present, not `none` |
| 10 | — | Driver's earnings show CHF 23.20 | Stripe → Connect → the account's balance |

**Step 9 is where the previous bug lived.** A row reading `captured` with
`transfer none` means the delivery was marked paid while nothing moved.
`payment:trace` prints that in red for exactly this reason.

### Then break it on purpose

Worth ten extra minutes, because these are the states a real user will reach and
you will otherwise meet them for the first time in production.

- **Cancel the sheet** at step 4 instead of authorising. Delivery must be
  `unpaid`, not stuck half-created, and the sender must be able to retry.
- **Fail test payment** at step 4. Delivery must be `failed` and retryable.
- **Cancel the delivery** after step 4 but before step 9. Expect `refunded`, the
  full CHF 25 back, and a refund visible in Stripe.
- **Kill the app** between authorising in TWINT and returning. The webhook is
  the source of truth, so the delivery must still reach `authorised` on its
  own. If it does not, the flow depends on the client coming back, which is the
  one thing you cannot rely on.

---

## Phase 2 — Live, one small real payment

Only after Phase 1 is clean end to end.

### Gates

- `twint_payments` capability is **`active`**, not `pending`. TWINT holds the
  capability pending until it has verified a reachable site whose legal notice
  carries the company name and legal form, the full address, and contact
  details, with prices shown in CHF.

  Checked against `website/legal.js`, the Impressum has all of it: DeltaSci
  Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, UID
  CHE-347.257.714, hello@shlep.ch and a phone number. **But Netlify is not
  git-linked** — verify `shlep.ch/legal.html?doc=impressum` actually serves
  this, because the repo being right has not meant the site was, on this
  project, more than once.
- The driver account has completed **live** Express onboarding with a real
  IBAN. Test-mode onboarding does not carry over.
- Live keys on the server, live `pk_live_` in the build, a **separate** live
  webhook endpoint with its own signing secret.

### The run

One delivery, **CHF 20**. Not CHF 2 — the CHF 1.50 fee floor would take most of
it and the split would tell you nothing about the normal case. At CHF 20 the
split is CHF 1.80 to the platform and CHF 18.20 to the driver.

Same ten steps. Pay with TWINT account A from a phone that is **not** the one
running the driver profile.

Expect to lose Stripe's processing fee on the round trip — that is the cost of
the test, and it is the only honest way to find out what a real sender sees.

### Then, the same day

Refund it from the Stripe dashboard and confirm `payment:trace` shows
`refunded` with the full amount. A refund path you have never run is not a
refund path.

---

## When something fails

| Symptom | Almost always |
| --- | --- |
| Payment sheet never opens | Build has no publishable key, or it is a `pk_live_` against a test-mode server |
| TWINT succeeds, app hangs | `returnURL` missing — rebuild, this is not an OTA fix |
| Stripe shows the payment, app shows unpaid | Webhook not registered, or `STRIPE_WEBHOOK_SECRET` wrong. Check Stripe → Webhooks → the endpoint's recent deliveries |
| Delivered, but `payment authorised` | Transfer failed. The server logs the reason; usually the driver's `transfers` capability is inactive |
| `captured` with `transfer none` | Pre-existing bug, now fixed — if you see it, an old build is deployed |
| Driver balance CHF 0 after capture | Transfer went to the wrong connected account, or the platform balance was empty |

---

## What this does not test

Said plainly, so it is not mistaken for coverage:

- **Disputes.** TWINT disputes exist and are rare. No path has been exercised.
- **Payout timing to a real IBAN.** Phase 2 proves the transfer; the bank leg
  takes its own schedule.
- **Concurrency under load.** `payment:battle` covers the double capture via
  idempotency key; two real phones racing has not been tried.
- **Anything above CHF 5,000** — TWINT's per-transaction ceiling. An XL long-haul
  will not reach it, but the app does not currently refuse it either.
