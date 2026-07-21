# Tasks

## Active

- [ ] **Apply for Stripe account (Payments + Connect Express + TWINT)** - critical path, longest lead time
  - Blocked by: legal entity + live shlep.ch website
  - Register: https://dashboard.stripe.com/register → enable Connect (Express): https://dashboard.stripe.com/connect → enable TWINT: https://dashboard.stripe.com/settings/payment_methods
  - Info/pricing: https://stripe.com/en-ch/pricing · https://stripe.com/en-ch/connect · https://stripe.com/en-ch/payments/twint
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
  - 3. Add those records at your domain registrar (wherever shlep.ch DNS is managed, e.g. Infomaniak/Hostpoint/Cloudflare): DNS settings → paste each record type/name/value exactly. Verification usually turns green in minutes-to-hours
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
- [ ] **Fill in legal entity details for shlep.ch** - needed before TWINT/Stripe application
  - Impressum: legal entity name + form (GmbH/AG/Einzelfirma), registered address, UID (CHE-…), authorised signatory
  - Privacy: data controller entity + address, set up a real privacy@shlep.ch (or similar) inbox
  - Terms: confirm place of jurisdiction
  - Files: `website/legal.js` and `packages/app/src/legal/content.ts` (search for `[bracketed]` placeholders)

## Waiting On

## Someday

- [ ] **Validate insurance cost with a Swiss broker** - AXA / Helvetia sharing-economy group policies; the ~CHF 0.40/delivery estimate in Shlep_Cost_Summary.md is US-benchmarked
  - AXA business contact: https://www.axa.ch/en/corporate-customers.html · Helvetia: https://www.helvetia.com/ch/web/en/business-customers.html
- [ ] **Activate formsubmit relay** - submit waitlist + contact form once after deploying shlep.ch, click confirmation link sent to hello@shlep.ch

## Done
