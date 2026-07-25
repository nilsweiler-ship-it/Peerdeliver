# Tasks

## Active

- [ ] **Apply for Stripe account (Payments + Connect Express + TWINT)** - critical path, longest lead time
  - Blocked by: legal entity + live shlep.ch website
  - Register: https://dashboard.stripe.com/register → enable Connect (Express): https://dashboard.stripe.com/connect → enable TWINT: https://dashboard.stripe.com/settings/payment_methods
  - Info/pricing: https://stripe.com/en-ch/pricing · https://stripe.com/en-ch/connect · https://stripe.com/en-ch/payments/twint
  - Business website field: enter **https://shlep.ch** — but deploy the site there FIRST. Stripe's reviewers actually open it and check: publicly reachable, describes what you sell (the landing page does), pricing visible, terms/privacy/Impressum with real entity details (fill the [bracketed] placeholders before applying), and a working contact (kontakt.html / hello@shlep.ch). Don't use a placeholder page, a social profile, or an unrelated domain — mismatches between the site and the application are a common rejection reason.
  - How important for the MVP: **not needed to build, demo, or test — mandatory the moment real money moves.**
    - Without it, everything still works in simulated-payment mode: full app flow, investor demos, TestFlight testing with friendly users. Nothing blocks development.
    - With real users it's non-negotiable: it IS the escrow ("payment captured only on code-verified delivery"), the driver payouts incl. their KYC/IBAN, the 9%-fee capture, and TWINT itself. No Stripe = no revenue, no payout, and the trust promise on the website isn't true.
    - It's also a validation gate: the pilot is supposed to prove people *pay through the product* — cash/personal-TWINT workarounds would invalidate exactly that (see Shlep_Validation_Protocol Phase 2).
    - Why start now anyway: it's the only signup with a real review process (entity check, TWINT enablement) — weeks, not minutes. Applying early means it's ready when the first real delivery is.
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
  - Prerequisite: you control shlep.ch DNS — same registrar access you'll need for the website deploy anyway
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
- [ ] **Activate the waitlist/contact relay** - submit the waitlist form once on the live site → confirmation email lands at hello@shlep.ch → click the link (one-time formsubmit activation, then signups + contact messages arrive by email)
  - BLOCKED until the MX fix above — hello@shlep.ch cannot receive mail right now

- [ ] **FIX DNS: shlep.ch is served by NETLIFY, not Hostpoint** - discovered 2026-07-25; the Hostpoint DNS zone is inactive, so anything added there does nothing
  - Live nameservers: `dns1–4.p04.nsone.net` (Netlify DNS). Edit records at: Netlify → Domains → shlep.ch → **DNS panel** (NOT Hostpoint "Domain-Zugriff")
  - [x] ~~**1. Restore mail**~~ DONE 2026-07-25 — MX + SPF verified live in DNS:
    `10 mx1.mail.hostpoint.ch` / `10 mx2.mail.hostpoint.ch`, TXT `v=spf1 redirect=spf.mail.hostpoint.ch`
    (records that were added in Netlify DNS:)
    | Type | Name | Value | Priority |
    |---|---|---|---|
    | MX | @ (shlep.ch) | `mx1.mail.hostpoint.ch` | 10 |
    | MX | @ (shlep.ch) | `mx2.mail.hostpoint.ch` | 10 |
    | TXT | @ (shlep.ch) | `v=spf1 redirect=spf.mail.hostpoint.ch` | — |
    - optional (mail client autoconfig): CNAME `autoconfig` → `autoconfig.mail.hostpoint.ch`, CNAME `autodiscover` → `autoconfig-nonssl.mail.hostpoint.ch`
    - NEXT: create the `hello@shlep.ch` mailbox/forwarding alias in **Hostpoint → E-Mail**, then send a test mail from Gmail to confirm delivery
  - **2. Re-do Resend domain verification** (currently "Failed" because its records went into the dead Hostpoint zone):
    Resend → Domains → shlep.ch → copy the DKIM/SPF/return-path records → paste them into **Netlify DNS** → click Verify again
    - note: if Resend also wants an SPF TXT on the root, MERGE it with the Hostpoint SPF above into ONE record — two SPF TXT records on the same name break both
  - **3. Later, for the API:** the `api.shlep.ch` CNAME from Render also goes into Netlify DNS
  - Also: set up the `hello@shlep.ch` forwarding alias in Hostpoint (E-Mail section) once MX resolves again

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

## Someday

- [ ] **Validate insurance cost with a Swiss broker** - AXA / Helvetia sharing-economy group policies; the ~CHF 0.40/delivery estimate in Shlep_Cost_Summary.md is US-benchmarked
  - AXA business contact: https://www.axa.ch/en/corporate-customers.html · Helvetia: https://www.helvetia.com/ch/web/en/business-customers.html
- [ ] **Activate formsubmit relay** - submit waitlist + contact form once after deploying shlep.ch, click confirmation link sent to hello@shlep.ch
- [ ] **Have AGB/Datenschutz reviewed by a Swiss lawyer before public launch** - drafted in-house; the visible "template" disclaimer was removed on 2026-07-21, so treat review as due diligence, not optional forever
- [ ] **Verify authorised signatory in Impressum matches HR entry** - "Nils Weiler" was filled in; cross-check with the Handelsregister excerpt (ref CH-020.4.069.680-8)

## Done

- [x] ~~Redeploy shlep.ch with the current site~~ (2026-07-25) - hosting is **Netlify** (project "shlep.ch", team Shlep), NOT Hostpoint — updated via Netlify Drop → Deploys → drag `website/` folder. Verified live: new design, 9%/min-fee pricing, packaging USP, Switzerland-wide copy, Kontakt page. NOTE: shlep.ch DNS is still managed at Hostpoint (Domain-Zugriff → DNS zone) — that's where Resend email records go later, but the website itself lives on Netlify (redeploy = drag folder onto the Netlify project, no Hostpoint involved).
- [x] ~~Fill in legal entity details for shlep.ch~~ (2026-07-21) - DeltaSci Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, UID/MWST CHE-347.257.714 (verified against uid.admin.ch), signatory Nils Weiler; lawyer-review disclaimers removed from site + app
