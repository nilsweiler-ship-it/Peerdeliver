# Tasks

## Active

- [ ] **Create Expo account** - unlocks push notifications + app builds for the stores
  - What it is: the Shlep app is built on Expo (the React Native framework in `packages/app`). An Expo account gives you two things: **Expo Push** (free notification service — "match found", "code needed", "delivered" alerts, currently not implemented) and **EAS Build** (cloud service that produces the installable iOS/Android binaries for TestFlight / Play Store — no Mac or Xcode setup needed)
  - 1. Create account at https://expo.dev/signup (free plan is enough for the pilot; builds cost ~$1-4 each on free tier or come with a paid plan; pricing: https://expo.dev/pricing)
  - 2. Tell Claude the account exists → Claude runs `eas init` to link the project (creates a projectId in app config) and implements `expo-notifications` (ask permission, register device token, server sends via Expo's push API — no extra signup)
  - 3. Only wrinkle: iOS push needs an APNs key and store builds need signing — both come from the **Apple Developer account** (see task above), Android's push credential from a free Firebase project. EAS walks through all of it interactively at first build
  - Order: can be done today; becomes fully useful once the Apple/Google developer accounts exist
  - No entity needed, ~5 min signup
- [ ] **Sign up Twilio Verify (or Vonage)** - SMS OTP for phone verification, currently simulated
  - Twilio: https://www.twilio.com/try-twilio → then create a Verify service: https://console.twilio.com/us1/develop/verify/services (pricing: https://www.twilio.com/en-us/verify/pricing)
  - Alternative: Vonage Verify: https://www.vonage.com/communications-apis/verify/
- [ ] **Verify Impressum entity text in browser** - open https://shlep.ch/legal?doc=impressum and confirm "DeltaSci Solutions GmbH" + UID CHE-347.257.714 render (page text is JS-rendered, couldn't auto-verify)

- [ ] **Point api.shlep.ch at the Render service** — API is LIVE on its `.onrender.com` URL (verified 2026-07-30: `/health` ok, `/api/partner/quote` returns a real quote incl. PostGIS coverage query). Only the custom domain is missing.
  - 1. Render → shlep-api → Settings → **Custom Domains** → add `api.shlep.ch`, copy the CNAME target it shows
  - 2. Netlify → Domains → shlep.ch → DNS → add CNAME, **name `api.shlep.ch` (full name — Netlify rejects `api` or `@`)**, value = Render's target
  - 3. Verify `curl https://api.shlep.ch/health` → `{"status":"ok"}`
  - 4. Then reload shlep.ch/partner.html — widget should show live coverage instead of an estimate

- [x] ~~Deploy the API~~ (2026-07-30) - Render blueprint applied; `shlep-api` + Postgres `shlep-db` running in Frankfurt. Pre-deploy fixes needed: user.ts enum type error (broke the Docker build), missing RESEND_API_KEY in render.yaml, missing .dockerignore (would have baked the Resend key into the image), and 39 commits stranded on the feature branch while Render deploys `main`.

  - Cost: ~USD 7/mo web + ~USD 6/mo DB on starter plans
  - **Operating notes for later:** `autoDeploy: true` — every push to `main` rebuilds. Secrets live in Render → shlep-api → Environment (`RESEND_API_KEY`, `PARTNER_API_KEYS`, Stripe keys later), never in the repo. Logs: Render → shlep-api → Logs.

## Waiting On

- [ ] **Apple + Google developer accounts — verification pending** (both started 2026-07-25, as DeltaSci Solutions GmbH)
  - Apple: enrolment underway; needs the D-U-N-S number — look it up / request free at https://developer.apple.com/enroll/duns-lookup/ (name + address must match the Handelsregister exactly)
  - Google Play: account created. Monetisation answer given: "Other" → commission on P2P delivery (9%, min CHF 1.50), payments external via Stripe/TWINT, physical service → exempt from Play Billing. **Keep this wording consistent** for app submission + Apple review notes.
  - Google identity verification can take a few days; Apple usually 1-2 days once D-U-N-S resolves
  - **When both are verified → tell Claude.** Next step is EAS: link the project, implement `expo-notifications`, produce the first TestFlight / internal-test build (needs the Expo account, see Active)

- [ ] **Stripe application under review** - submitted 2026-07-25 (DeltaSci Solutions GmbH, CHE-347.257.714, site shlep.ch, brand #14532D / accent #E0A32E)
  - Watch hello@shlep.ch / the Stripe dashboard for requests for extra documents — respond fast, that's the usual delay
  - **Once approved, three things to do:**
    1. Enable **Connect (Express)**: https://dashboard.stripe.com/connect — this is what pays drivers and collects their KYC/IBAN
    2. Enable **TWINT** as a payment method: https://dashboard.stripe.com/settings/payment_methods (may need separate activation; it's the CH default and ~1.3% vs 2.9% card, so it matters for margin)
    3. Copy the API keys into the backend env (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) → tell Claude and the app flips from simulated to real payments
  - Also set the webhook endpoint once the API is deployed: `https://api.shlep.ch/webhooks/stripe`

- [ ] **Stop form notifications landing in junk** - the relay works, but formsubmit mail hits Gmail's spam folder (it sends from their domain, not shlep.ch, so it fails DMARC alignment)
  - Interim: in Gmail mark the notification as "Not spam" + create a filter for `from:formsubmit.co` → never send to spam. Do this now so you don't miss real signups.
  - Proper fix: once Resend is verified + the API is deployed, move the waitlist/contact forms server-side (POST to our own endpoint → store in DB → notify via Resend from hello@shlep.ch). Removes the third-party dependency AND gives you the signups as data instead of emails.

## Someday

- [ ] **Validate insurance cost with a Swiss broker** - AXA / Helvetia sharing-economy group policies; the ~CHF 0.40/delivery estimate in Shlep_Cost_Summary.md is US-benchmarked
  - AXA business contact: https://www.axa.ch/en/corporate-customers.html · Helvetia: https://www.helvetia.com/ch/web/en/business-customers.html
- [ ] **Have AGB/Datenschutz reviewed by a Swiss lawyer before public launch** - drafted in-house; the visible "template" disclaimer was removed on 2026-07-21, so treat review as due diligence, not optional forever
- [ ] **Verify authorised signatory in Impressum matches HR entry** - "Nils Weiler" was filled in; cross-check with the Handelsregister excerpt (ref CH-020.4.069.680-8)

## Done

- [x] ~~Transactional email live (Resend)~~ (2026-07-26) - domain `send.shlep.ch` verified, DKIM/SPF aligned, test mail landed in **inbox** first try. Backend sends welcome, delivery-matched (+pickup code), picked-up (+delivery code), delivered receipt (+CO₂) and driver payout — branded templates in DE/FR/IT/EN. Fire-and-forget: a Resend outage can never fail a signup, handover or payout; no-ops without a key so dev/CI are unaffected.
  - Smoke test any time: `cd packages/server && npx tsx scripts/test-email.ts you@example.com`
  - Preview all templates: `brand/email-preview.html`
  - ⚠️ The key lives only in `packages/server/.env` (gitignored, untracked). Rotate it in Resend once things settle — it was pasted into a chat.

- [x] ~~Create Apple Developer + Google Play developer accounts~~ (2026-07-25) - both registered as the GmbH (company accounts avoid Google's 12-tester closed-test requirement). Verification pending — see Waiting On.

- [x] ~~Apply for Stripe account (Payments + Connect + TWINT)~~ (2026-07-25) - submitted with the live shlep.ch site, filled Impressum and brand assets. Now in review — see Waiting On.

- [x] ~~Restore mail routing for shlep.ch~~ (2026-07-25) - root cause: DNS is served by **Netlify** (`dns1-4.p04.nsone.net`), not Hostpoint — the Hostpoint zone is inactive and ignored. Added MX (`mx1`/`mx2.mail.hostpoint.ch`, prio 10) + SPF in Netlify DNS, verified live; hello@shlep.ch forwarding to Gmail confirmed working. **All future DNS changes (Resend records, api.shlep.ch CNAME) go in Netlify → Domains → shlep.ch → DNS.**

- [x] ~~Redeploy shlep.ch with the current site~~ (2026-07-25) - hosting is **Netlify** (project "shlep.ch", team Shlep), NOT Hostpoint — updated via Netlify Drop → Deploys → drag `website/` folder. Verified live: new design, 9%/min-fee pricing, packaging USP, Switzerland-wide copy, Kontakt page. NOTE: shlep.ch DNS is still managed at Hostpoint (Domain-Zugriff → DNS zone) — that's where Resend email records go later, but the website itself lives on Netlify (redeploy = drag folder onto the Netlify project, no Hostpoint involved).
- [x] ~~Fill in legal entity details for shlep.ch~~ (2026-07-21) - DeltaSci Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, UID/MWST CHE-347.257.714 (verified against uid.admin.ch), signatory Nils Weiler; lawyer-review disclaimers removed from site + app
