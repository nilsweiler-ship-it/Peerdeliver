# Tasks

## Active

- [ ] **Apply for Stripe account (Payments + Connect Express + TWINT)** - critical path, longest lead time
  - Blocked by: legal entity + live shlep.ch website
  - dashboard.stripe.com/register → enable Connect (Express) → enable TWINT payment method
- [ ] **Enroll Apple Developer Program ($99/yr) + Google Play ($25)** - D-U-N-S/company verification can take 1-2 weeks; needed for TestFlight
- [ ] **Sign up transactional email (Resend or Postmark)** - verify shlep.ch sending domain (DNS), app's email verification currently sends nothing
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
