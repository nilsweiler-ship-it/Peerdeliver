# Shlep / PeerDeliver — Pre-launch legal & regulatory risk review

**Scope:** "could this get litigated / regulated" pass over the pre-launch app, website and investor/partner materials. Switzerland-focused (Zürich pilot, CHF), with EU/GDPR noted for cross-border senders/recipients.

**Reviewer caveat:** I am **not a lawyer and this is not legal advice.** These are risks to run past qualified Swiss counsel (and, where flagged, a Swiss data-protection specialist and an insurance broker). Framing is deliberately conservative, as requested.

**What is already good** (so counsel time goes to the gaps): the team is unusually self-aware. The CO₂ model (`packages/shared/src/constants/co2.ts`) is conservative, sourced and clamps at zero. The ToS/privacy/Impressum exist in four languages (`packages/app/src/legal/content.ts`). The intermediary position is stated consistently. Identity and SMS self-certification are now blocked in code once the real providers are configured (`controllers/verification.ts`). The `insuredUpToCHF: 1000` fake has already been removed from the partner quote. Several risks below are already named in `GO_LIVE.md` / `STRIPE_ACTIVATION.md §0` — I've marked those and taken them as conservatively as the documents themselves do.

Severity ladder: **Showstopper** (do not launch until resolved) · **High** (resolve or get a written opinion before launch) · **Medium** (fix early in pilot) · **Low** (monitor / housekeeping).

---

## SHOWSTOPPER

### S1 — "Verified driver / ID checked by Stripe" is advertised as present fact while verification is still simulated

- **Risk:** Misleading commercial practice (UWG Art. 3 lit. b — unlautere Werbung) and a trust/safety misrepresentation that senders rely on to hand parcels to strangers. If a sender is harmed by a "verified" driver who was never actually checked, the gap between claim and reality is directly causal and documented in your own repo.
- **Trigger (file + quote):**
  - `website/index.html:527` — *"Jede fahrende Person bestätigt ihre … Identität mit einem amtlichen Ausweis und einem Selfie, **geprüft von Stripe**"* and `:287` *"**Verifizierte** Fahrer:innen"* — both present tense, unconditional.
  - `STRIPE_ACTIVATION.md §6` — *"**Identitätsprüfung … setzt weiterhin einfach `idVerified = true`.** … sollte nicht als geprüft kommuniziert werden."*
  - `controllers/verification.ts` `verify()` id-branch — still `data.idVerified = true` whenever `stripeConfigured()` is false; comment: *"while the website told senders every profile was verified."*
  - Stripe Identity requires the account application to be **approved** and two live webhooks registered (`Stripe_Identity_Antrag.md`, `GO_LIVE.md §1`) before any real check happens.
- **Worst case:** A harmed sender (or SECO / a competitor / consumer org) points to your own commit history showing you advertised "geprüft von Stripe" while the check was a no-op. UWG exposure, reputational collapse of the core trust proposition, and a plausible negligence hook against the platform.
- **Mitigation / ask counsel:** **Do not publish the verification claims until Stripe Identity is live and the webhooks are confirmed writing to the DB.** Until then, soften website + app copy to what is actually true ("Telefonnummer per SMS bestätigt; Ausweisprüfung in Einführung"). Have counsel review all "verifiziert/geprüft/verified" wording against UWG. Gate driver "VERIFIED" badges on the real `idVerified` set by webhook only.

### S2 — Payment model holds third-party funds; financial-market/AML classification is unresolved

- **Risk:** Under the chosen "Variante A" (separate charges + transfers), Shlep's Stripe balance **holds the sender's money between charge and the code-confirmed transfer** to the driver. That is exactly the activity that can make a platform a money/payment intermediary subject to GwG, and the GwV "Hilfsperson" exemption (Art. 2 Abs. 2 lit. a Ziff. 2) requires that you have **no power of disposal over customer funds** — which holding the float arguably defeats from delivery #1, independent of the berufsmässigkeit thresholds.
- **Trigger (file + quote):**
  - `STRIPE_ACTIVATION.md §0` — your own analysis: Variante A *"bedeutet …, dass Shlep zwischen Einzug und Transfer **fremde Gelder hält**"*; thresholds (CHF 50k / 20 relationships / CHF 2M) and the *"Vor dem Überschreiten muss ein Anwalt den Geldfluss beurteilt haben"* note.
  - `GO_LIVE.md` "Before you start" — *"Whether that makes Shlep a payment intermediary under Swiss law is not a question I can answer."*
  - Website states the escrow as fact: `website/index.html:523` *"Der Betrag wird bei der Bestellung **reserviert**"* (see also M-tier M5 — "reserviert" is also inaccurate for TWINT, which charges immediately).
- **Worst case:** FINMA/SRO determines unauthorised financial-intermediary activity; forced restructuring mid-pilot, back-affiliation to an SRO within a two-month deadline, frozen flows, personal-liability questions for the Geschäftsführer.
- **Mitigation / ask counsel:** **Get a written Swiss financial-markets/GwG opinion on the money flow *before the first real paid delivery*, not before the thresholds.** Bring the specific detail your docs already flag: separate-charges-and-transfers with `source_transaction`, driver paid from the sender's own charge. Ask counsel to assess whether Variante C (card auth + manual capture) should be the default and TWINT marked as immediate-pay, as `STRIPE_ACTIVATION.md` itself suggests. This is a "get the opinion before launch" item — the pilot cannot safely rely on "we won't hit 20 recurring drivers."

---

## HIGH

### H1 — Driver employment misclassification → AHV / social-insurance exposure for the platform

- **Risk:** Swiss authorities (SVA / courts) look at economic dependence, who sets the price, control and integration — not the "self-employed" label. Shlep **sets the price algorithm** (`pricing.ts`), runs ratings, controls matching and payout, and brands the drivers as "our" verified fleet. The Federal Court has already treated Uber drivers as employees (Geneva). A platform found to be the employer owes retroactive AHV/IV/EO/ALV contributions plus the drivers' share, with penalties.
- **Trigger:** `pricing.ts` (`estimatePriceCHF`, `DEFAULT_FEE_POLICY`) — platform-set price and 9% cut; rating/verification system; investor copy *"automatic driver payouts"*, *"90% goes to the driver"* (`Shlep_Outreach_Emails.md`) framing drivers as supply under platform control.
- **Worst case:** SVA reclassification across all drivers → five/six-figure retroactive contributions + fines; drivers claim employee protections (vacation, continued pay).
- **Mitigation / ask counsel:** Social-security/employment opinion on the driver relationship. Design toward genuine independence: driver sets/accepts their own price, no exclusivity, clear "occasional, your-own-account" framing, and tell drivers they are responsible for their own AHV and tax. Keep the fee a pure intermediation fee.

### H2 — Drivers' private motor/liability insurance likely excludes carrying goods for pay; no one is told

- **Risk:** Standard Swiss private car insurance (Motorfahrzeug-Haftpflicht/Kasko) commonly excludes or restricts **commercial/gewerbliche** use and carriage of goods for a fee. A driver who crashes or has goods stolen while on a paid Shlep run may find their insurer **denies the claim**. Nothing in onboarding warns them. The platform promoting paid carriage without this warning invites "you induced an uninsured activity" claims.
- **Trigger:** `OnboardingScreen.tsx` / `PublishRouteScreen.tsx` collect plate + vehicle but no insurance acknowledgment; `GO_LIVE.md` — *"There is no transport insurance … no process for a parcel that arrives broken. The first one will arrive by email and you will improvise."*; FAQ `website/index.html:523` confirms no transport insurance.
- **Worst case:** Driver's accident claim denied; driver (and/or an injured third party) turns to the platform; bodily-injury scenarios are the expensive ones.
- **Mitigation / ask counsel:** Insurance broker + counsel. At minimum, a mandatory onboarding acknowledgment that the driver has confirmed their own insurance covers paid carriage and is responsible for it. Explore a platform-level goods-in-transit / accident policy before scaling.

### H3 — Prohibited/dangerous/illegal goods shipped unseen between strangers; platform is the conduit

- **Risk:** Senders can ship anything; there is no inspection, and the handover model is designed for parcels handed over *without* packaging or sight of contents. Drugs, weapons, stolen goods, cash, counterfeits move through a system you operate and take a fee on. Beyond reputational, there's potential facilitation/receiving exposure and a driver unknowingly committing an offence (transporting narcotics).
- **Trigger:** ToS §3 prohibits it (`legal/content.ts`) but it is an unenforced promise; FAQ advises *"Wertsachen, Bargeld und Ausweise gehören nicht in eine Sendung"* as advice only; `Shlep_Partner_Onepager.md` actively markets *"keine Verpackungspflicht … Übergabe von Hand zu Hand"* (no packaging) which reduces any chance of noticing contents.
- **Worst case:** A driver is stopped carrying illegal goods; or the platform is named in a criminal matter as the facilitating marketplace; takedown/seizure; press.
- **Mitigation / ask counsel:** A per-request **prohibited-items acknowledgment** (sender actively confirms at creation, logged), a clear reporting/cooperation-with-authorities clause in ToS, a mechanism to suspend and report, and KYC on senders (not just drivers) at least to Stripe-Identity level before scaling. Ask counsel about the platform's exposure as marketplace operator.

### H4 — Recipient (a non-user third party) personal data processed without notice or lawful-basis clarity

- **Risk:** The sender supplies the **recipient's phone/email**, and Shlep **sends the recipient an SMS**. The recipient is often not a user, never saw the privacy policy, and never consented. nFADP (revDSG) Art. 19 duty to inform and GDPR Art. 14 (data obtained other than from the data subject) both bite; the privacy policy is silent on recipients' data and how a recipient exercises rights.
- **Trigger:** `schema.prisma` `DeliveryRequest.recipientPhone` / `recipientEmail` + comment *"Phone is often the only thing a sender has for someone they met on a marketplace"*; `services/sms.ts` `notifyRecipientPickedUp()` texts the code to that number; `legal/content.ts` privacy §2/§4 never mentions recipients.
- **Worst case:** FDPIC/EDÖB complaint from a texted recipient; GDPR complaint from an EU recipient; the duty-to-inform gap is a clean, documentable violation.
- **Mitigation / ask counsel (data-protection specialist):** Add recipients to the privacy notice; include a one-line privacy/opt-out notice + link in the recipient SMS; define legal basis (legitimate interest / contract performance for the sender) and a retention limit for recipient contact data.

### H5 — Privacy policy omits sub-processors, international transfers and the Identity sensitive-data processing

- **Risk:** The policy lists "service providers (hosting, payments, email)" generically. It does not name Stripe/Twilio/Resend/Render, does not address **cross-border transfer** (these providers route data to the US/EU — nFADP Art. 16/17 adequacy + safeguards; GDPR Chapter V SCCs), and does not mention that **ID/biometric data** (sensitive personal data, nFADP Art. 5 lit. c) is processed via Stripe Identity — even though, commendably, it never reaches your servers. No DPAs are referenced.
- **Trigger:** `legal/content.ts` privacy §4/§5/§7 (generic, no names, no transfer disclosure, no Identity mention); `services/identity.ts` (Stripe Identity flow); header comment in `legal/content.ts` — *"drafted in-house … a review by a Swiss lawyer before public launch is still tracked in TASKS.md."*
- **Worst case:** FDPIC/GDPR finding of inadequate transparency; the sensitive-data omission is the sharpest point.
- **Mitigation / ask counsel:** Data-protection lawyer to finalise the privacy policy: name sub-processors, disclose transfers + safeguards (SCCs/adequacy), describe the Identity processing and legal basis, add concrete retention periods, and confirm signed DPAs with each processor. This is the already-tracked "lawyer review before launch."

---

## MEDIUM

### M1 — Pre-ticked consent box bundling ToS + privacy
`RegisterScreen.tsx:63` `const [agreed, setAgreed] = useState(true)` — the terms+privacy checkbox defaults to **checked**. Pre-ticked consent is invalid under GDPR (recital 32) and poor practice under nFADP; bundling ToS acceptance with privacy acknowledgment compounds it. **Fix:** default unchecked, require an affirmative tick; consider separating privacy acknowledgment from ToS acceptance.

### M2 — No cancellation / refund / dispute process defined
`GO_LIVE.md` admits there is no process for a parcel that arrives broken. ToS §4/§5 are silent on cancellation, refunds, and what the handover-code dispute path is. Swiss law gives limited withdrawal rights (OR Art. 40a for certain doorstep/phone contracts), and consumers will expect *some* recourse. **Fix:** Define and publish a cancellation/refund policy and a dispute procedure (code-disputed, non-delivery, damage) before launch; counsel to confirm withdrawal-right applicability.

### M3 — Abandoned `in_transit` delivery traps the sender's money indefinitely
`GO_LIVE.md` "What will still be untested" — *"A driver who abandons mid-transit. Nothing times out. The delivery sits `in_transit` indefinitely and the sender's money sits with it."* This is a consumer-harm + funds-holding problem that also feeds S2. **Fix:** auto-timeout + auto-refund path; this is also the cleanest way to reduce how long you hold funds.

### M4 — No transaction ceiling enforced; TWINT caps / declared value unbounded in places
`GO_LIVE.md` — *"Anything above CHF 5,000 — TWINT's per-transaction ceiling … the app does not currently refuse it."* Partner quote accepts `declaredValueCHF` up to 100000 (`partner.ts` quoteSchema). High-value items with no insurance and no cap raise both consumer-protection and the funds-holding profile. **Fix:** enforce a sensible value/price ceiling; refuse or route high-value items with explicit "no insurance" acknowledgment.

### M5 — "Reserviert" / escrow wording is inaccurate for TWINT
`website/index.html:523` and `new.html` describe the amount as *"reserviert"* (reserved/held, implying a card authorization released later). Per `STRIPE_ACTIVATION.md §0`, TWINT has **no `capture_method: manual`** — it is charged immediately into the platform balance. Describing an immediate charge as a reservation is a (minor) misrepresentation and reinforces S2. **Fix:** describe the mechanism accurately per payment method ("gezahlt und bis zur Zustellung zurückgehalten" for TWINT vs. "reserviert" for card auth).

### M6 — Licence-plate "verified" is only a format check
`controllers/verification.ts` `verify()` plate-branch validates canton + format only; `STRIPE_ACTIVATION.md §6` confirms no registry lookup. The app shows a plate "Verified" pill. Not currently claimed on the public website, so lower than S1, but the in-app "verified" badge overstates it. **Fix:** label it "format checked" / "plate on file," not "verified," until a real data provider is wired.

---

## LOW

### L1 — Trademark / brand collision risk for "Shlep"
"Shlep"/"schlep" is a common Yiddish/English word (to haul/drag) — descriptive for a delivery service, which makes it **weak and hard to protect**, and there are existing delivery/logistics ventures using Shlep/Schlep/Sherpa-type names in various markets. **Fix:** instruct an IP attorney to run a CH (IGE/Swissreg) + EUIPO + international clearance search and file a CH word/figurative mark; confirm `shlep.ch` ownership and secure social handles. Quick flag only, as requested.

### L2 — CO₂ marketing is well-substantiated — keep it that way
The methodology (`co2.ts`) is conservative, sourced (WEF 2020; 0.20/0.27 kg/km; packaging factors), clamps negatives to zero, and the hero "~10 kg" figure carries a specific-scenario footnote on the site. **This is low greenwashing risk and a model for the other claims.** One watch-item: the partner widget returns `co2SavedKg` for marketplaces to reuse in *their* sustainability comms — add terms that partners may not aggregate or restate it as guaranteed savings, to avoid being drawn into a partner's greenwashing claim.

### L3 — Postal-market (PostG/PostCom) and road-transport licensing — monitor, low now
As an intermediary (not itself a postal operator or a >3.5t commercial road carrier), Shlep is unlikely to trigger PostCom registration (CHF 500k postal-revenue threshold) or goods-transport licensing in the pilot. Individual drivers in private cars <3.5t carrying occasional parcels are also below licensing. **Fix:** monitor the PostCom registration threshold as volume grows; counsel to confirm the intermediary classification holds and that drivers stay clearly non-commercial-carrier.

### L4 — VAT on the platform fee
The Impressum shows DeltaSci is MWST-registered (`CHE-347.257.714 MWST`), so VAT applies to the 9% commission. ToS §4 correctly pushes drivers' own tax onto them. **Fix:** confirm with the fiduciary that MWST is charged/accounted on the platform fee and that cross-regional/foreign-sender cases are handled; low but keep clean from day one.

### L5 — Wide-open CORS (cross-ref: security review)
`packages/server/src/index.ts:16` `app.use(cors())` allows any origin across the whole API (the partner quote route separately uses `origin:'*'` by design). This is primarily a security finding (deferred to the security review) but has a light data-protection angle. Flagging for cross-reference only.

---

## Suggested counsel line-up (so the founder can brief efficiently)
1. **Swiss financial-markets / GwG lawyer** — S2 (money flow, intermediary classification, SRO) — *before first paid delivery.*
2. **Data-protection specialist (nFADP + GDPR)** — H4, H5, M1 — finalise privacy policy, sub-processors, transfers, Identity, recipients.
3. **Employment / social-security lawyer** — H1 (driver classification, AHV).
4. **Insurance broker + liability counsel** — H2, H3 (driver insurance gap, goods-in-transit, prohibited goods).
5. **Commercial/consumer + advertising (UWG) counsel** — S1, M2, M5 — verification claims, cancellation/refund, escrow wording.
6. **IP attorney** — L1 (trademark clearance + filing).

**Must-fix-before-launch:** S1, S2, H4, H5, M1 (and the S1 copy changes are nearly free). **Get-an-opinion-before-launch:** S2, H1, H2, H3. **Early-pilot:** M2–M6. **Monitor/housekeeping:** L1–L5.
