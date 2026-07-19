# Shlep — Integrations & API Plan (MVP, Switzerland-wide pilot)

*Which external APIs are needed to move from the current simulated/dual-mode build to a real MVP for a **nationwide Swiss pilot**. "Status today" reflects what's actually in the code. Priorities assume a public-facing pilot across all of Switzerland (DE/FR/IT regions), not a small closed cohort.*

## Overview table

| # | Capability | Real API / service | Status today | MVP priority | Notes |
|---|---|---|---|---|---|
| 1 | Payments (TWINT + card) | **Stripe** (Payments) | Simulated TWINT fallback; real Stripe wired if keys set | **Must** | TWINT + cards are Stripe methods. Needs Swiss legal entity, live keys, webhook. Your only real variable cost (~1.3% TWINT / 2.9%+0.30 card). |
| 2 | Driver payouts + bank/KYC | **Stripe Connect** (Express) | Simulated ("payout-ready" for all) | **Must** | Connect onboarding also collects driver IBAN + identity/KYC. Pays out the 90% split. |
| 3 | Push notifications | **Expo Push** (`expo-notifications`) | Not implemented | **Must** | Free. Essential UX: match found, driver en route, code needed, delivered. |
| 4 | Transactional email | **Resend / Postmark / SES** | Screen exists, no email actually sent | **Must** | Email verification, receipts, delivery notifications. ~$0–20/mo at pilot scale. |
| 5 | Phone verification (SMS OTP) | **Twilio Verify / Vonage / MessageBird** | Simulated (accepts any valid-format number) | **Must** | Baseline trust for a stranger-to-stranger network at national scale. Pay-per-OTP. |
| 6 | Identity / ID check (KYC) | **Stripe Identity / Onfido / Sumsub / Veriff** | Simulated (instant `idVerified`) | **Nice** | Strongly recommended before broad public launch; can start as manual/photo review in pilot. Note: Stripe Identity pairs naturally with #1–2. |
| 7 | Map tiles | **Mapbox / MapTiler** (or native Apple/Google map) | `react-native-maps` real, but `UrlTile` needs a production tile source | **Nice** | Becomes **Must** if you keep custom `UrlTile` — the public OSM tile server isn't for production. Free alternative: use the native provider (Apple on iOS is free; Google on Android needs a key). |
| 8 | Routing / ETA | **Google Directions / Mapbox / OpenRouteService** | Not used (ETA is an estimate) | **Nice** | Only needed if you want true drive-time ETAs and road-snapped routes. |
| 9 | Licence-plate authentication | *(no consumer Swiss registry API)* | Format + canton check only | **Nice** | No clean API in CH. Keep format check + photo/manual review; a KYC vendor can capture the document. |
| 10 | Address search / geocoding | **geo.admin.ch** (Swiss federal) | ✅ In place, free | — | Already live and nationwide — covers all cantons. No work or cost. |
| 11 | Live GPS location | Device GPS (`expo-location`) | ✅ In place | — | Real driver location already streams over the socket; server only simulates a path when GPS is absent. |

## The MVP shortlist

To leave "demo mode" for a real Switzerland-wide pilot, the **Must-haves** are: **Stripe Payments + Connect (1, 2), Expo push notifications (3), transactional email (4), and SMS phone verification (5).** Everything else can be phased in.

**Nice-to-haves** (add as you scale or as trust needs grow): ID/KYC (6), a production map-tile provider (7), routing/ETA (8), and licence-plate handling (9).

## Switzerland-wide implications (vs. a Zürich-only pilot)

- **Languages:** a national pilot spans the DE/FR/IT regions — the multilingual support already built covers this. (Romansh, the 4th official language, is optional and very small.)
- **Trust matters more:** with strangers matching across regions rather than one city, phone verification (5) moves up to Must, and ID/KYC (6) becomes a near-term follow-up rather than "later."
- **Maps at national scale:** country-wide coverage makes a reliable tile source (7) more pressing than for a single city — decide between a paid tile provider or switching `UrlTile` to the native map provider.
- **Support & operations:** nationwide means multilingual support and clearer dispute handling from day one (see the validation protocol).
- **Unchanged:** geocoding (geo.admin.ch) and GPS already work nationwide at no cost.

## Where to sign up — Must-have APIs (in setup order)

Ordered by how early to start: Stripe first (longest lead time — needs a Swiss legal entity and account review), then email, then push, then SMS.

| Order | Service | What to set up | Sign up / request | Pricing |
|---|---|---|---|---|
| 1 | **Stripe — Payments** | Account + API keys + webhook (TWINT + card) | https://dashboard.stripe.com/register | https://stripe.com/en-ch/pricing |
| 1b | **Stripe — Connect** | Enable Connect (Express) for driver payouts + KYC/IBAN | https://stripe.com/en-ch/connect (enable in dashboard → Connect) | https://stripe.com/en-ch/connect/pricing |
| 1c | **Stripe — TWINT** | Enable TWINT payment method (CHF, Swiss entity) | https://stripe.com/en-ch/payments/twint | https://stripe.com/en-ch/local-payment-methods |
| 2 | **Transactional email** | Verify a sending domain, get API key | Resend: https://resend.com/signup · Postmark: https://account.postmarkapp.com/sign_up | https://resend.com/pricing · https://postmarkapp.com/pricing |
| 3 | **Expo Push notifications** | Expo account (push is free); add `expo-notifications` | https://expo.dev/signup · docs: https://docs.expo.dev/push-notifications/overview/ | Free (EAS plan only if you also want OTA/builds) |
| 4 | **SMS phone verification** | Twilio Verify service (or alternative) | Twilio: https://www.twilio.com/try-twilio · Verify: https://www.twilio.com/en-us/user-authentication-identity/verify | https://www.twilio.com/en-us/verify/pricing |

**Alternatives if you prefer:**
- SMS OTP: Vonage Verify — https://www.vonage.com/communications-apis/verify/ · Bird (MessageBird) — https://bird.com
- Email: Amazon SES — https://aws.amazon.com/ses/

**Nice-to-have (when you're ready):**
- Stripe Identity (ID/KYC, pairs with your Stripe account): https://stripe.com/en-ch/identity · Onfido: https://onfido.com · Sumsub: https://sumsub.com · Veriff: https://www.veriff.com
- Map tiles: MapTiler https://www.maptiler.com/cloud/ · Mapbox https://www.mapbox.com
- Routing/ETA: OpenRouteService (free tier) https://openrouteservice.org · Mapbox Directions https://www.mapbox.com/navigation

*Verify current pricing and Swiss availability on each provider's page before committing — figures change. Stripe is the critical-path item: start the account + entity setup first, as approval and TWINT enablement take the longest.*

*Costs for the paid services are detailed in `Shlep_Cost_Summary.md`. This plan is uncommitted — nothing here changes the app yet.*
