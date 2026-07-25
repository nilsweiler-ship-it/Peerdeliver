# Tasks

## Active

- [ ] **Enroll Apple Developer Program ($99/yr) + Google Play ($25)** - D-U-N-S/company verification can take 1-2 weeks; needed for TestFlight
  - Apple: https://developer.apple.com/programs/enroll/ (company enrollment needs a D-U-N-S number: https://developer.apple.com/support/D-U-N-S/)
  - Google Play Console: https://play.google.com/console/signup
- [ ] **Sign up transactional email (Resend or Postmark)** - so the app can actually send verification emails, receipts & delivery notifications (the screens exist, but no email service is connected yet)
  - What it is: a service with an API the backend calls to send email ("resend.emails.send(...)") — reliable delivery, no own mail server. Recommendation: **Resend** (simplest, free up to 3k emails/mo, enough for pilot)
  - 1. Create account at https://resend.com/signup (alternative: https://account.postmarkapp.com/sign_up) — use nils.weiler@gmail.com for now; switch to hello@shlep.ch later
  - 2. In Resend: "Domains" → Add Domain → `shlep.ch`. It shows 3-4 DNS records (SPF, DKIM, return-path) — these prove to Gmail & co. that Shlep is allowed to send from @shlep.ch, otherwise everything lands in spam
  - 3. Add those records in **Netlify → Domains → shlep.ch → DNS panel** (that's where shlep.ch DNS actually lives — NOT Hostpoint). Verification usually turns green in minutes-to-hours
  - 4. In Resend: create an API key → goes into `packages/server/.env` as e.g. `RESEND_API_KEY=...` (Claude wires the send calls into the backend once the key exists)
  - 5. Test: send yourself a verification email from staging; check it arrives in Gmail inbox (not spam)
  - **Current state: the shlep.ch domain in Resend shows "Failed"** — its records were added to the dead Hostpoint zone. Re-copy them into Netlify DNS and hit Verify again.
  - ⚠️ SPF: the root already has `v=spf1 redirect=spf.mail.hostpoint.ch` (for Hostpoint mail). If Resend wants its own SPF on the root, do NOT add a second TXT — send Claude both values and they get merged into one valid record.
  - No entity needed, no review process — 15 min of clicking + DNS wait
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

- [ ] **Deploy the API to api.shlep.ch** - last blocker before a partner can integrate live (widget currently falls back to local price estimates)
  - Repo now has `render.yaml` + `packages/server/Dockerfile` — Render reads them automatically
  - 1. Push this repo to GitHub (private is fine)
  - 2. https://dashboard.render.com → New → **Blueprint** → select the repo → Apply. Creates `shlep-api` (Frankfurt) + Postgres `shlep-db`
  - 3. In the DB shell run once: `CREATE EXTENSION IF NOT EXISTS postgis;` (driver-route matching needs it)
  - 4. Set env var `PARTNER_API_KEYS` = `demo:pk_demo_shlep_2026` (add real partners later as `name:key` pairs)
  - 5. Render → shlep-api → Settings → **Custom Domain** → `api.shlep.ch` → add the CNAME it shows in **Netlify DNS** (shlep.ch DNS is served by Netlify)
  - 6. Verify: `curl https://api.shlep.ch/health` → `{"status":"ok"}`, then reload shlep.ch/partner.html — the demo widget should show live coverage instead of an estimate
  - Cost: ~USD 7/mo web + ~USD 6/mo DB on starter plans

## Waiting On

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

- [x] ~~Apply for Stripe account (Payments + Connect + TWINT)~~ (2026-07-25) - submitted with the live shlep.ch site, filled Impressum and brand assets. Now in review — see Waiting On.

- [x] ~~Restore mail routing for shlep.ch~~ (2026-07-25) - root cause: DNS is served by **Netlify** (`dns1-4.p04.nsone.net`), not Hostpoint — the Hostpoint zone is inactive and ignored. Added MX (`mx1`/`mx2.mail.hostpoint.ch`, prio 10) + SPF in Netlify DNS, verified live; hello@shlep.ch forwarding to Gmail confirmed working. **All future DNS changes (Resend records, api.shlep.ch CNAME) go in Netlify → Domains → shlep.ch → DNS.**

- [x] ~~Redeploy shlep.ch with the current site~~ (2026-07-25) - hosting is **Netlify** (project "shlep.ch", team Shlep), NOT Hostpoint — updated via Netlify Drop → Deploys → drag `website/` folder. Verified live: new design, 9%/min-fee pricing, packaging USP, Switzerland-wide copy, Kontakt page. NOTE: shlep.ch DNS is still managed at Hostpoint (Domain-Zugriff → DNS zone) — that's where Resend email records go later, but the website itself lives on Netlify (redeploy = drag folder onto the Netlify project, no Hostpoint involved).
- [x] ~~Fill in legal entity details for shlep.ch~~ (2026-07-21) - DeltaSci Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, UID/MWST CHE-347.257.714 (verified against uid.admin.ch), signatory Nils Weiler; lawyer-review disclaimers removed from site + app
