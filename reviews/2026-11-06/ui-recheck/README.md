# Shlep web build: UI fix re-check, 2026-11-06

Setup: a fresh `expo export --platform web` of `/home/claude/shlep/work-qa` was written to the scratchpad (`scratchpad/webdist`, not `packages/app/dist`) and served on :8091. The bundle was **not patched**. Alerts come from the app's own `utils/alert.ts` and were captured with Playwright `page.on('dialog')`. Native browser dialogs do not appear in screenshots, so the dialog texts are quoted below. The API on :3001 is unchanged and was left running. Playwright used Chromium at 390×844, with locale de-CH and en-GB (the app takes its language from the browser locale and sends `Accept-Language`). Seed: `scratchpad/re/seed.mjs`, users r-*-mw5f2jg0@example.com.

| # | Result | What I saw | Screenshots |
|---|---|---|---|
| 1 | **PASS** | Unverified driver claims Box F → 403 → `confirm`: "Zuerst verifizieren\n\nBitte bestätige zuerst deine Identität und deine Telefonnummer, bevor du Lieferungen übernimmst.\n\nOK: Jetzt verifizieren". OK opens Verifizierung & Vertrauen, and the sheet is closed (the old sheet-over-screen bug is fixed). Plain alerts: `alert` "Danke für deine Bewertung!" after rating, and `alert` "Gewicht prüfen …" on weight validation. | 01a-claim-sheet-before-de, 01b-claim-after-dialog-OK-de, 08e-after-rating-submitted-de |
| 2 | **PASS** | en-GB: "Verify yourself first\n\nPlease confirm your identity and phone number before you take deliveries.\n\nOK: Verify now". The server also answers in English when sent `Accept-Language: en` (checked with curl). Too-heavy weight in EN: "Check the weight — Size S carries at most 5 kg. Choose a larger size." | 01a/01b-*-en, 03-weight-tooheavy-after-submit-en |
| 3 | **PASS** | "2,5" was accepted, and the API stores `packageWeight: 2.5` (Small, pending; the flow continued to TWINT). "abc" → "Gewicht prüfen — Gib das Gewicht als Zahl ein, z. B. 2,5 oder 2.5." (EN equivalent too). 999 on S → "Grösse S trägt höchstens 5 kg …". All checks run client-side before any request. No "Expected number" text appeared anywhere. | 03-weight-comma-*, 03-weight-abc-*, 03-weight-tooheavy-* |
| 4 | **PASS** | Badges: OFFEN/UNTERWEGS/WIRD GEKLÄRT/GELIEFERT and PENDING/IN TRANSIT/UNDER REVIEW. Driver timeline: Zugeordnet…Geliefert, "Wird geklärt" / Matched…Delivered, "Under review". No raw keys. | 04a-my-shipments-badges-de/en, 04b-sheet-*, 06b-driver-active-*-card-de/en |
| 5 | **FAIL** (regression) | Tab labels are now **completely invisible**: each label element is 0 px tall. The bar keeps the navigator's default 49 px on web, and `paddingTop: 6` (`MainTabs.tsx:67`), `tabBarItemStyle.paddingVertical: 2` (`:74`) and the item's own 5+5 px padding leave no room under the icon. Only icons show. | 05-tabbar-sender-de, 00-home-de |
| 6 | **FAIL** (ETA part PASS) | The "ETA 14:25" pill is gone. But the six code boxes have **collapsed to ~2 px slivers** (de and en). `CodeBoxes` now uses `flex:1; maxWidth:44` inside the `codeInputWrap` Pressable (`ActiveDeliveryScreen.tsx:458`, style only `position:'relative'`), which shrink-wraps inside the centred ticket. The row then has no width, so `flex:1` boxes get 0 width. Fix: `alignSelf:'stretch'` (or `width:'100%'`) on `codeInputWrap`. | 06c-driver-code-boxes-de/en |
| 7 | **PASS** | The checkbox text reads "Ich habe gelesen und akzeptiere: Allgemeine Geschäftsbedingungen · Datenschutzerklärung". The button stays `aria-disabled` until the box is ticked. The register body includes `"acceptTerms":true`, and it lands on "Willkommen, Rita". | 07a–07d-register-*-de |
| 8 | **PASS** | Ratings open with 0 stars and "Bewertung absenden" disabled (a forced click does nothing). Picking star 4 enables it, and submitting gives the success alert. | 08c-ratings-initial-de/en, 08d-ratings-4-stars-de, 08e-after-rating-submitted-de |
| 9 | **PASS** | "Bisher gespartes CO₂" / "CO₂ saved so far". | 00-home-de/en |
| 10 | **PASS** | No raw translation keys (ui./sender./status./… pattern) on any screen visited: home, available list and sheet, verification, create steps 1–3, shipments, sheets, driver active, completed, ratings, register. | — |

## New bugs

1. **[High, layout] Tab labels hidden.** See item 5. `navigation/MainTabs.tsx:67,74`. Either drop `paddingTop` and the item `paddingVertical`, or set an explicit `height` of about 60 plus the bottom inset.
2. **[High, layout] Delivery-code boxes collapsed.** See item 6. `screens/driver/ActiveDeliveryScreen.tsx:458` (`codeInputWrap` needs `alignSelf:'stretch'`), together with `components/brand/CodeBoxes.tsx:42-43`. The driver cannot see the digits they type.
3. **[Low, i18n] TWINT payment screen is hard-coded English in DE:** `screens/sender/TwintPaymentScreen.tsx:111,117,120,139,145` ("AMOUNT TO PAY", "Scan with the TWINT app…", "MOBILE NUMBER", "Confirm in TWINT", "Simulated payment · no real charge"). See 03-weight-comma-after-submit-de.
4. **[Low, i18n] Package size names are English in DE:** "Small · …", "Medium · …" on cards and in the sheet. The source is `PACKAGE_SIZES[..].label` from `shared/src/constants/delivery-status.ts:55-56`, used in `components/delivery/DeliveryCard.tsx:39` and `AvailableDeliveriesScreen.tsx:194`.
5. **[Low, i18n] Register placeholder "e.g. VW Golf"** is English in the German form (07c).
6. **[Low, a11y, web] The terms checkbox has no aria-checked:** `role="checkbox"` renders, but `aria-checked` stays null after ticking (`RegisterScreen.tsx:283`; RN-web's TouchableOpacity drops `accessibilityState`). The rating stars have no button role or label either.

## Re-check 2 (fresh web export of the updated work-qa, same setup, de-CH)

| # | Result | What I saw | Screenshots |
|---|---|---|---|
| 1 Tab labels | **FAIL** | Better than before, but still clipped: only the top ~5 px of each label shows. Measured: bar 62 px (782–844), tab item 43 px with 5+5 px padding; the label element is **5 px tall** (824–829, `overflow:hidden`, 11 px font). The icon slot plus padding (bar `paddingTop 6` + `paddingBottom 8`, item `paddingVertical 2`, item's own 5+5 px) leave no room. Fix: about 10 more px, e.g. `height: 72 + insets.bottom`, or drop `tabBarItemStyle.paddingVertical` and `paddingTop` (`MainTabs.tsx:66-75`). | 2-05-tabbar-crop-de, 2-05-home-tabbar-de |
| 2 Code boxes | **PASS** | Six boxes, each 36–38 px wide (not 44: they flex to fit a 308 px ticket) and 54 px tall, all inside the ticket (x 66–324 within 41–349). Typing "123" fills boxes 1–3 and highlights box 4. No ETA pill. The recipient's incoming screen does not use `CodeBoxes`: it shows the plain "251918" code in its ticket and still looks right. | 2-06a-driver-code-boxes-empty-de, 2-06b-driver-code-boxes-typed-de, 2-06d-recipient-incoming-code-de |
| 3 TWINT in German | **PASS** | "ZU ZAHLENDER BETRAG", "Mit der TWINT-App scannen …", "HANDYNUMMER", "In TWINT bestätigen", "Simulierte Zahlung · keine echte Belastung". After confirming: "Zahlung bestätigt … Bezahlt und zurückgehalten …", "Weiter". No English left. | 2-07a-twint-de, 2-07b-twint-after-confirm-de |
| 4 Route sizes | **PASS** | "Verfügbarer Platz": S Klein / M Mittel / L Gross / XL Extra gross. | 2-08-publish-route-sizes-de |
| 5 Register | **PASS** | Placeholder "z. B. VW Golf". The checkbox has `role=checkbox` with aria-checked false → true (tick) → false (untick). | 2-09a-register-placeholder-unticked-de, 2-09b-register-ticked-de |

Still open (not in this batch): delivery cards and the recipient list still show "Small · …" / "Medium · …" in German (`components/delivery/DeliveryCard.tsx:39`, which uses `PACKAGE_SIZES[..].label`; visible in 2-06d). The incoming sheet for a disputed parcel was not re-checked. No raw translation keys were seen in this pass.

## Re-check 3 (fresh web export, tab bar 72 px + inset, translated size labels)

| # | Result | What I saw | Screenshots |
|---|---|---|---|
| a Tab labels | **PASS** | Every label is fully rendered: 13 px tall, scrollHeight = clientHeight, y 814–827, with no clipping. DE: Start / Sendungen / Routen / Chat / Profil. EN: Home / Shipments / Routes / Chat / Profile. | 3-tabbar-crop-de, 3-tabbar-crop-en, 3-home-de, 3-home-en |
| b Size labels | **PASS** | My shipments cards: "Klein · …", "Mittel · …". Nearby list cards: "Mittel · Box F …". Nearby sheet title: "Box F (open, pending) · Mittel". No "Small/Medium" left and no raw keys. | 3-delivery-cards-de, 3-nearby-sheet-de |
