# Going live

Companion to `STRIPE_ACTIVATION.md` (which prepares the account) and
`TESTING.md` (which proves the code).

---

## The thing to understand first

**`acct_1TL4Ba9s4LgD9mOs` is a Stripe Sandbox, and a sandbox has no live
mode.** Everything built and tested so far lives there.

So this is not "flip two keys". It is a second setup on the **DeltaSci
business account**, where nothing carries over except the code:

| | Sandbox (today) | Business account (live) |
| --- | --- | --- |
| API keys | `sk_test_51TL4Ba…` | new, `sk_live_…` |
| Webhook endpoint | created, working | **must be created again** |
| Signing secret | in Render now | different, replaces it |
| Connected accounts | `acct_1ULT5h…` etc. | **drivers onboard again** |
| TWINT capability | `not_requested` | **already approved** ✓ |
| Identity application | test mode | needs submitting |

The one piece with someone else's timeline — TWINT approval — is already done
on the business account. Everything else is yours to do in an afternoon.

---

## Before you start

Two things that are not about Stripe, and are more likely to hurt you.

**Get §0 of `STRIPE_ACTIVATION.md` in front of a lawyer.** The money is held
between a sender paying and a recipient confirming a code. Whether that makes
Shlep a payment intermediary under Swiss law is not a question I can answer,
and it is cheaper to ask now than to be asked later. Separate-charges-and-
transfers with `source_transaction` was chosen partly because the driver is
paid from the sender's own charge rather than from a float you hold — bring
that detail, it matters.

**Decide what happens when a delivery goes wrong.** There is no transport
insurance, the terms say so, and the app says so. What there is not: a process
for a parcel that arrives broken. The first one will arrive by email and you
will improvise. Better to have decided.

---

## 1 · Stripe, on the business account

Switch the Dashboard to the **DeltaSci business account**, live mode (no
`/test/` in the URL).

- [ ] **Identity application** — dashboard.stripe.com/identity/application.
      Without it, document checks fail in live mode even though they work in
      the sandbox.
- [ ] **Connect** is enabled, Express accounts, platform profile complete.
- [ ] **TWINT** shows `active` under Settings → Payment methods. *(Already
      approved — confirm rather than assume.)*
- [ ] **Webhook endpoint** → `https://api.shlep.ch/webhooks/stripe`, with
      **six** events:
      ```
      payment_intent.succeeded
      payment_intent.payment_failed
      charge.refunded
      account.updated
      identity.verification_session.verified
      identity.verification_session.requires_input
      ```
      The last two are new since the sandbox endpoint was made. Miss them and
      identity checks pass at Stripe and never reach the database — the exact
      shape of the fault that left five deliveries unpaid in October.
- [ ] Copy its **signing secret**.

## 2 · Render

All three at once, then one **Save, rebuild, and deploy**:

- [ ] `STRIPE_SECRET_KEY` → the live `sk_live_…`
- [ ] `STRIPE_PUBLISHABLE_KEY` → the live `pk_live_…`, **from the same page**
- [ ] `STRIPE_WEBHOOK_SECRET` → the new live `whsec_…`

Then:

```sh
npm run status
```

Expect `stripe: live mode · ok` and `stripe publishable key · matches acct_…`.
That check compares the account id embedded in the publishable key against the
account the secret key belongs to — it is there because a `pk_live_` from the
wrong account cost an afternoon, looking green the whole time.

## 3 · The app

The app takes its publishable key **from the API**, so no rebuild is needed
for the key itself. A rebuild *is* needed if anything native changed.

- [ ] `npm run status` shows the live key before you distribute anything
- [ ] Build with `EXPO_PUBLIC_STRIPE_PK` set to the live key as a fallback

## 4 · Re-onboard yourself as a driver

Connected accounts do not cross from sandbox to live. Your own driver profile
starts from nothing: real IBAN, real ID, real date of birth.

Do this **before** telling anyone else, so the first person to hit a broken
payout flow is you.

## 5 · One real delivery, small

**CHF 20.** Not CHF 2 — the CHF 1.50 fee floor would eat it and tell you
nothing about the normal case. At 20 the split is 1.80 / 18.20.

Pay with TWINT from a phone that is **not** the one running the driver
profile. Then:

```sh
npm run payment:stripe
```

Looking for `captured` with a real `tr_…`.

Then **refund it the same day** from the Stripe dashboard and confirm
`payment:trace` shows `refunded` for the full amount. A refund path you have
never run is not a refund path.

## 6 · Keep the sandbox

Do not delete it. `npm run e2e` runs against it on every push, which is the
only thing standing between a regression and your first real driver. CI keeps
pointing at the sandbox; only production moves.

---

## What will still be untested after all this

- **Disputes.** TWINT disputes are rare — 25–50 per million — and no path has
  been exercised.
- **A second concurrent delivery.** The double-capture case is covered by an
  idempotency key; two real phones racing is not.
- **Anything above CHF 5,000** — TWINT's per-transaction ceiling. An XL
  long-haul will not reach it, and the app does not currently refuse it
  either.
- **A driver who abandons mid-transit.** Nothing times out. The delivery sits
  `in_transit` indefinitely and the sender's money sits with it.
- **Routes with a departure in the past.** They stay active forever; a sender
  can request a delivery on a trip that happened last week.

The last two are the ones I would fix before the tenth delivery rather than
the first.
