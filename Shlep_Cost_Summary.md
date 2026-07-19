# Shlep — Deployment Cost Summary

*Estimated running costs to take Shlep from pilot to full-scale production. Figures are 2026 list prices in USD unless noted; treat as planning estimates, not quotes. Sources listed at the end.*

---

## 1. What your stack already gets for free

These are real costs for most apps that Shlep avoids by design:

- **Address search** — Swiss federal `geo.admin.ch` API (free). No Google Places bill (Places autocomplete alone can run hundreds of $/month at scale).
- **Maps** — stylized SVG, not a paid maps SDK. Adding real map tiles later (Mapbox/Google) would introduce usage cost.
- **Auth** — self-hosted JWT. No Auth0/Clerk subscription.
- **SSL/TLS** — free via the hosting platform (Let's Encrypt).

---

## 2. One-time & annual fixed costs

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | **$99 / year** | Required to publish on the App Store |
| Google Play registration | **$25 one-time** | No recurring fee |
| Domain (`.ch` + `.com`) | **~$30 / year** | `.ch` ≈ CHF 10–15/yr; grab `.com` too |
| Company/trademark (optional) | varies | Not infrastructure — budget separately |

**Fixed baseline: ~$125 first year, ~$130/yr thereafter.**

---

## 3. Monthly infrastructure by stage

Three realistic stages. "MAU" = monthly active users.

| Service | Pilot (<1k users) | Growth (~5k MAU) | Scale (~50k MAU) |
|---|---|---|---|
| Backend hosting (Render/Railway/Fly) | $7–15 | $25 | $100–450 |
| Managed Postgres (Neon/Supabase/Render) | $0–7 | $20–30 | $50–200 |
| Transactional email (Resend/Postmark)¹ | $0 (free 3k) | $20 | $35–90 |
| Object storage for avatars (R2/S3)² | $0–5 | $5–10 | $20–50 |
| Error monitoring (Sentry free → paid) | $0 | $0–26 | $80+ |
| Expo EAS (builds + OTA updates)³ | $0 (free) | $0–199 | $199 + overages |
| **Infra subtotal / month** | **~$15–50** | **~$90–300** | **~$500–1,100** |

¹ You send verification/notification emails — the app already has an email-verification screen.
² Only if you store user-uploaded avatars; small until scale.
³ **The biggest swing.** EAS Production is $199/mo (50k MAU, OTA updates, build credits). You can stay on the **free plan** through pilot and pay per build (~$1–4 each), or self-host builds — so EAS is optional early and the main lever on the Growth number.

---

## 4. Payment processing — your one real variable cost

This is a **cost of revenue** (scales with transactions), not a fixed bill:

- **Card payments (Stripe CH):** 2.9% + CHF 0.30 per transaction.
- **TWINT:** ~1.3% (direct); routed through Stripe as a bank redirect.
- **Stripe Connect:** small monthly fee per *active* connected (driver) account that receives a payout, plus payout fees.

**Why this matters for your margin — a CHF 24 delivery at the 9% + min. CHF 1.50 fee (CHF 2.16 revenue):**

| Payment method | Processing fee | % of your CHF 2.40 revenue |
|---|---|---|
| Card (2.9% + 0.30) | ~CHF 1.00 | **~46%** |
| TWINT (~1.3%) | ~CHF 0.31 | **~14%** |

**Takeaway:** on small Swiss tickets, card fees eat a large share of the platform take. Steering users to **TWINT** roughly triples your net margin per delivery — a strong reason to make TWINT the default and to factor Stripe Connect's per-active-account fee into driver-payout economics.

---

## 5. Bottom line

| | Monthly infra | + Annual fixed | + Payments |
|---|---|---|---|
| **Pilot** (Zürich, <1k users) | ~$15–50 | ~$130/yr | ~2–3% of GMV |
| **Growth** (~5k MAU) | ~$90–300 | ~$130/yr | ~2–3% of GMV |
| **Full scale** (~50k MAU) | ~$500–1,100 | ~$130/yr | ~2–3% of GMV |

**Practical starting point (recommended pilot stack): ~$25–40/month all-in**, using Railway or Render Starter for the API, Neon/Supabase free-or-Basic Postgres, Resend free tier, Sentry free, and the EAS free plan. Payment fees only kick in once real deliveries flow.

The headline: infrastructure is cheap and predictable — you can run the full Zürich pilot for well under $50/month. **Payment processing is the cost that actually scales with the business, and TWINT-vs-card mix is the single biggest lever on unit margin.**

---

## Assumptions & notes

- MAU-tier infra costs assume a single-region deployment (Europe) with one primary API service + one Postgres instance, scaling vertically then horizontally.
- Excludes salaries, marketing/CAC, insurance, legal, and accounting — see the pre-seed use-of-funds in the deck for those.
- Prices are 2026 list prices and change; confirm on each provider's pricing page before committing.
- Not included because your build avoids them today: maps SDK usage, geocoding/Places, SMS (Twilio), Auth provider.

## Sources

- [Apple Developer / Google Play fees (2026)](https://splitmetrics.com/blog/google-play-apple-app-store-fees/)
- [Stripe Switzerland pricing](https://stripe.com/en-ch/pricing) · [Stripe Connect pricing](https://stripe.com/en-ch/connect/pricing) · [TWINT fees](https://www.twint.ch/en/business-customers/twint-fees/)
- [Render pricing](https://render.com/pricing) · [Railway vs Render vs Fly (2026)](https://northflank.com/blog/railway-vs-render)
- [Expo EAS pricing](https://expo.dev/pricing)
- [Neon / Supabase / Render Postgres comparison (2026)](https://selfhost.dev/blog/managed-postgresql-comparison-2026/)
- [Resend pricing](https://resend.com/pricing) · [Postmark pricing](https://postmarkapp.com/support/article/1107-how-does-monthly-pricing-work)

---

## 6. Platform fee derivation (adopted 2026-07-19: 9% with CHF 1.50 minimum)

Bottom-up cost per delivery (CHF), assuming 70% TWINT / 30% card mix, weekly-batched payouts, ~4 deliveries per active driver/month:

| Component | CHF / delivery | Nature |
|---|---|---|
| Payment processing (mix) | 0.31–1.00 → ~0.52 @ CHF 24 | part fixed, part % |
| Stripe Connect active-account fee (amortised) | ~0.50 | fixed |
| Payout fee (batched) | ~0.06 | fixed |
| Shipment insurance (group policy, avg. declared ~CHF 100, benchmark ~1.25% of value) | ~0.40 | ~fixed |
| Infra/email/monitoring (pilot volume) | ~0.15 | fixed |
| Refund/chargeback reserve (0.5% GMV) | ~0.12 | % |
| **Total** | **~1.50–2.10** | mostly fixed |

Because the cost is mostly **fixed per delivery**, it is 12.3% of a CHF 12 ticket but only 5.3% of CHF 40 — a flat percentage cannot be both cost-covering and honest at all ticket sizes.

**Chosen structure: 9% with a CHF 1.50 minimum.** Break-even around CHF 17; margin +0.14 at CHF 20, +0.41 at CHF 24, +1.49 at CHF 40. The minimum protects small tickets (below ~CHF 16.70 the CHF 1.50 floor applies). Communicated as "91% goes to the driver" with the minimum disclosed in pricing UI, FAQ and AGB.

Context for investors: pure-cost recovery is deliberate pilot positioning; marketplace take-rate benchmarks run far higher (Airbnb ~14–16%, Uber ~25–30%), leaving obvious headroom.
