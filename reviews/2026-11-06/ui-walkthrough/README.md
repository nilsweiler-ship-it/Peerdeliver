# Shlep web build: UI walkthrough, 2026-11-06

Setup: fresh `expo export --platform web` of `/home/claude/shlep/work-qa` (served on :8090). The local API ran in simulated-payment mode. Playwright used Chromium at 390×844 with the de-CH locale, plus spot checks in en-GB and it-CH. `api.shlep.ch` was routed to `localhost:3001`, and `api3.geo.admin.ch` (address autocomplete) was mocked. Data was seeded through the API with `scratchpad/walk/seed.mjs`: users w-*-mw5a92fu@example.com, deliveries Box A–F.

**Important web caveat:** in react-native-web, `Alert.alert` is a no-op (`class Alert { static alert() {} }`). On the web build **no alert is ever shown**, including the error, success and "Zuerst verifizieren" alerts. For this walkthrough I temporarily patched the *built bundle* in `dist/` with a small DOM dialog shim, so the alerts and their buttons could be seen and clicked. The alert screenshots therefore show the shim's dialog, not native UI. The original bundle was restored afterwards. No source files under `packages/` were modified.

| # | Result | Notes | Screenshots |
|---|---|---|---|
| 1 | **PASS** (with bugs) | Unverified driver: tapping claim gives a 403 response and the alert "Zuerst verifizieren" with [Abbrechen, Jetzt verifizieren]. "Jetzt verifizieren" opens Profil → Verifizierung & Vertrauen. Publishing a route gives the same alert, and the same button navigates correctly. Bugs: the delivery sheet stays open on top of the Verification screen, and English users see the German server message. | 01a–01f (`*-de`, `*-en`) |
| 2 | **PASS** | After "Kennzeichen verifizieren", the plate row shows "ZH 123456 ✓ Erfasst". The trust score goes from 1/4 to 2/4 "verified", so a plate that was only recorded counts as verified, and "verified" is not translated. | 02a, 02b, 02c |
| 3 | **PASS** | The in-transit sheet shows "Problem melden", which opens the Report-a-problem screen. The submit button stays disabled for a reason that is too short. Submitting a real reason gives "Danke — wir kümmern uns" and returns to the list, where the badge reads DISPUTED. The sheet then shows "WIRD GEKLÄRT" with the payment-held text. The EN version ("BEING LOOKED INTO") is fine too. The badge is untranslated. The sheet has no timeline. | 03a–03i |
| 4 | **PASS** | Active deliveries: Box A and Box B are both disputed, and both still show the 6-digit code entry, "Lieferung bestätigen" and the note "Es wurde ein Problem gemeldet …". The status line "Under review" is hard-coded English, and the 6th code box is clipped at the card edge. | 04b, 04c, 04d (`de`/`en`) |
| 5 | **PASS** | A recipient linked by account sees the delivery code for in-transit Box C (831943) and disputed Box B (473135). For the disputed parcel the headline still reads "Dein Paket ist gleich da", which is misleading. | 05a, 05b, 05c (`de`/`en`) |
| 6 | **PASS** | The delivered sheet shows "Fahrende Person bewerten", which opens the Ratings screen ("Geliefert!"). Stars respond to taps (2 → 5). Submitting gives "Danke für deine Bewertung!", and after reopening, the rate button is gone. Five stars are preselected (`RatingsScreen.tsx:27`), which inflates scores. | 06a–06g |
| 7 | **PASS** (server messages) / **FAIL** (input handling) | The budget is a slider limited to CHF 5–200 in steps of 5, so 12.34 cannot be entered and "5 Rappen" cannot be triggered from the UI. Weight and declared value are free-text fields with no client-side checks. A weight of 999 kg on S gives the server's message "Grösse S trägt höchstens 5 kg. Wähle eine grössere Grösse." A declared value of 99999 gives "Sendungen über CHF 10000 …". Problems: a weight of "abc" shows the raw message `packageWeight: Expected number, received null`, and "2,5" is **silently saved as 2 kg**. The alert title is the generic "Etwas ist schiefgelaufen". | 07a–07f |
| 8 | **PASS** | The terms box starts unticked, the button stays `aria-disabled` and clicking it does nothing. Ticking the box enables the button and registration succeeds. With it-CH the screen is Italian, the request body carries `"language":"it"`, the DB stores `it` and the home screen is Italian. | 08a–08f (`de`/`it`) |
| 9 | see bugs | No raw i18n keys (e.g. `dispute.title`) were seen. Many hard-coded English strings, two clipping issues and one wrong production URL were found. | various |

## Bugs

1. **[High, web] No alerts at all on the web build.** `react-native-web` stubs `Alert.alert`. Web users never see errors, success messages or the verify-first prompt (I checked this before adding the shim: tapping claim did nothing visible). Fix: add a `utils/alert.ts` wrapper that uses `window.confirm`/`window.alert` or an in-app modal when `Platform.OS === 'web'`, and use it everywhere `Alert.alert` is called.
2. **[High, prod] Socket points at a dead domain.** `src/services/socket.ts:9` uses `'https://api.peerdeliver.ch'` in release builds, while `api.ts` was fixed to `api.shlep.ch`. Realtime chat and location will fail in production. Fix: share the same base URL.
3. **[Med] Weight parsing.** `CreateRequestScreen.tsx:184` uses `parseFloat(weight)`, which turns "2,5" into 2 (the Swiss keypad decimal is a comma) and "abc" into NaN, which is sent as null and shows a raw zod message. Fix: `parseFloat(weight.replace(',', '.'))` plus a client-side check that the value is a number, positive and within `PACKAGE_SIZES[size].maxKg`. Do the same for declared value and `maxLoadKg` (`RegisterScreen.tsx:94`).
4. **[Med] The detail sheet stays open over Verification.** In `AvailableDeliveriesScreen.tsx:79-83` the `catch` calls `showApiError(..., navigation)` without `setSelectedDelivery(null)`. The RN `<Modal>` then covers the Verification screen (also on native). Fix: close the sheet before navigating, e.g. `setSelectedDelivery(null)` in the catch.
5. **[Med] Server messages are always German.** `utils/apiError.ts:22` prefers the server message over `t('verification.requiredBody')`, so the English UI shows "Bitte bestätige zuerst …". This applies to every server error. Fix: for known codes use the translated string. Longer term, localise on the server via the user's `language` or `Accept-Language`.
6. **[Med, layout] Tab-bar labels are clipped.** `navigation/MainTabs.tsx:64` sets `height: 64` with `paddingTop 8` and `paddingBottom 10`, so labels ("Start", "Profil") are cut off and only a few pixels show (visible in every screenshot). Fix: drop the fixed height, or raise it to about 72 plus the safe-area inset.
7. **[Low, layout] The 6-digit code entry overflows its ticket.** On ActiveDeliveryScreen the `TicketStub` (around line 180) clips the 6th box at 390 px (04c/04d). Fix: give the boxes `flex:1` and `maxWidth` instead of a fixed width.
8. **[Low, i18n] Hard-coded English in German, French and Italian UI:**
   - `StatusBadge.tsx:29` (PENDING, IN TRANSIT, DISPUTED, DELIVERED)
   - `StatusTimeline.tsx:7-24` (Matched … Delivered, "Under review")
   - `HomeScreen.tsx:195-196` ("CO₂ saved this year", "car trips never made")
   - `AvailableDeliveriesScreen.tsx:94,134` ("km away", "Available nearby") and "Distance" in the sheet
   - `MyShipmentsScreen.tsx:277` ("My shipments")
   - `ActiveDeliveryScreen.tsx:181` ("DELIVERY CODE")
   - `CreateRequestScreen.tsx:273,279` (stepper "Package/Address/Budget", "Shipping from a marketplace?")
   - `RegisterScreen.tsx:120,240,292` ("STEP 2 / 2", "How will you use Shlep?", "How much can you carry?", S/M/L captions, "Create account →")
   - `LoginScreen.tsx:53` (the whole hero)
   - VerificationScreen ("verified", "Verified drivers get more…", "Swiss plate format check…")
9. **[Low] The terms copy contradicts the checkbox.** The text reads "Mit dem Fortfahren akzeptierst du …" next to a checkbox you must tick. Reword to "Ich akzeptiere die AGB und die Datenschutzerklärung". The checkbox `TouchableOpacity` (`RegisterScreen.tsx:266`) has no `accessibilityRole="checkbox"` or `accessibilityState`. Consent is not sent to the server or stored (no `termsAcceptedAt`).
10. **[Low] Smaller issues:**
    - The disputed recipient view says "Dein Paket ist gleich da".
    - The "Abgeschlossen 1" segment wraps onto two lines in My shipments (03a).
    - The status pill on the sheet map is clipped at the left edge, and the `#PD-…` chip is almost invisible on the map (03b/03i).
    - The verification prompt for publishing a route says "bevor du Lieferungen übernimmst".
    - Ratings default to 5 stars.
    - The plate counts toward "x / 4 verified".

Not exercised: native-only behaviour (real `Alert`, keyboard types) and Stripe/TWINT payment UI (simulated mode).
