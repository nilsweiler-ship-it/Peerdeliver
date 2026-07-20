# Tasks

## Active

- [ ] **Apply for Stripe account (Payments + Connect Express + TWINT)** - critical path, longest lead time
  - Blocked by: legal entity + live shlep.ch website
  - dashboard.stripe.com/register → enable Connect (Express) → enable TWINT payment method
- [ ] **Enroll Apple Developer Program ($99/yr) + Google Play ($25)** - D-U-N-S/company verification can take 1-2 weeks; needed for TestFlight
- [ ] **Sign up transactional email (Resend or Postmark)** - so the app can actually send verification emails, receipts & delivery notifications (the screens exist, but no email service is connected yet)
  - What it is: a service with an API the backend calls to send email ("resend.emails.send(...)") — reliable delivery, no own mail server. Recommendation: **Resend** (simplest, free up to 3k emails/mo, enough for pilot)
  - 1. Create account at resend.com/signup (use nils.weiler@gmail.com for now; switch to hello@shlep.ch later)
  - 2. In Resend: "Domains" → Add Domain → `shlep.ch`. It shows 3-4 DNS records (SPF, DKIM, return-path) — these prove to Gmail & co. that Shlep is allowed to send from @shlep.ch, otherwise everything lands in spam
  - 3. Add those records at your domain registrar (wherever shlep.ch DNS is managed, e.g. Infomaniak/Hostpoint/Cloudflare): DNS settings → paste each record type/name/value exactly. Verification usually turns green in minutes-to-hours
  - 4. In Resend: create an API key → goes into `packages/server/.env` as e.g. `RESEND_API_KEY=...` (Claude wires the send calls into the backend once the key exists)
  - 5. Test: send yourself a verification email from staging; check it arrives in Gmail inbox (not spam)
  - Prerequisite: you control shlep.ch DNS — same registrar access you'll need for the website deploy anyway
  - No entity needed, no review process — 15 min of clicking + DNS wait
- [ ] **Create Expo account** - push notifications (free); match/code/delivered alerts not yet implemented
- [ ] **Sign up Twilio Verify (or Vonage)** - SMS OTP for phone verification, currently simulated
- [ ] **Fill in legal entity details for shlep.ch** - needed before TWINT/Stripe application
  - Impressum: legal entity name + form (GmbH/AG/Einzelfirma), registered address, UID (CHE-…), authorised signatory
  - Privacy: data controller entity + address, set up a real privacy@shlep.ch (or similar) inbox
  - Terms: confirm place of jurisdiction
  - Files: `website/legal.js` and `packages/app/src/legal/content.ts` (search for `[bracketed]` placeholders)

## Waiting On

## Someday

- [ ] **Validate insurance cost with a Swiss broker** - AXA / Helvetia sharing-economy group policies; the ~CHF 0.40/delivery estimate in Shlep_Cost_Summary.md is US-benchmarked
- [ ] **Activate formsubmit relay** - submit waitlist + contact form once after deploying shlep.ch, click confirmation link sent to hello@shlep.ch

## Done
