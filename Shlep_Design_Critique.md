# Shlep — Design Critique

*An expert review of the redesigned app, judged against three lenses: fidelity to the design handoff, Apple Human Interface Guidelines (HIG), and WCAG 2.1 accessibility. Findings are prioritized P0 (fix before launch) → P2 (polish). Contrast ratios below are measured.*

---

## Overall assessment

The redesign is a large, coherent step up: a distinctive, ownable identity (spruce + warm paper + the route-line motif), consistent tokenized components, and the carbon story surfaced as a recurring, first-class element. It reads as a real product, not a template. The issues below are mostly refinements — one accessibility fix and one UX-logic fix are worth doing before you put it in front of investors or testers.

---

## P0 — Fix before launch

**1. Low-contrast caption text (accessibility).**
`textLight` / `ink3` (`#A39C8C`) is used for captions and mono micro-labels (date line, tracking IDs, meta rows). Measured contrast:

- `#A39C8C` on paper `#F4F0E7` = **2.4:1**
- `#A39C8C` on white = **2.7:1**

WCAG AA requires **4.5:1** for normal text. This fails, and these labels (dates, ratings, IDs) carry real information. **Fix:** darken the caption/label token to ~`#7C7466` (≈4.5:1) or use `textSecondary` (`#6F6A5F`, 4.73:1 — passes) for anything text-bearing, reserving `textLight` for decorative-only use.

**2. Delivered screen shows the driver a rating for themselves.**
The celebration screen (13) is wired to fire when the *driver* confirms delivery, but its copy asks "How was [driver]?" with a star rating — that's the *sender's* action, not the driver's. As built, a driver rates themselves. **Fix:** either (a) show the driver a rating-free "Delivered!" + carbon celebration and route the star-rating version to the sender/recipient flow, or (b) gate the rating card by role. Low effort, avoids an obviously wrong moment in a demo.

---

## P1 — Should fix

**3. Placeholder data reads as fake in a demo.**
The Active-delivery map shows a hardcoded "ETA 14:25" regardless of the delivery. In a live demo or screenshot this undercuts the "real MVP" claim. **Fix:** compute a rough ETA (or hide the chip when unknown) rather than a constant.

**4. Stylized map doesn't reflect the actual route.**
The SVG map is the same abstract path for every delivery. It's on-brand and fine as a placeholder, but a savvy viewer will notice it's not their route. **Fix (later):** integrate `react-native-maps` with the route-line styling preserved (moss origin, terracotta destination, dashed spruce path) — the handoff explicitly anticipates this swap.

**5. `impactLeaf` mono micro-labels on the spruce gradient are borderline.**
`#7FC79B` on spruce = 4.83:1 (passes for normal text) but the labels are 10px mono — small text at the low end. It's readable but tight. **Fix:** either bump those labels to 11–12px or use the lighter `impactOnDark` (`#CFEBD8`) for small text on dark surfaces.

**6. Custom-font `fontWeight` leftovers.**
A few styles still set `fontWeight` alongside a specific-weight custom font family (e.g. the Input label, Avatar initials). iOS ignores `fontWeight` when the family is a fixed weight, so it's harmless but inconsistent. **Fix:** map those to the correct `fonts.*` family (e.g. `fonts.bodySemi`) so weight is explicit and correct across platforms.

---

## P2 — Polish

**7. Dynamic Type / larger text.** Font sizes are fixed points. HIG encourages supporting the user's text-size setting. At minimum, verify the hero numerals and headlines don't clip if the OS text size is bumped; ideally allow scaling on body text.

**8. Safe-area consistency.** Home, Profile, Earnings, and Login handle top insets; do a pass to confirm every scroll screen (wizard steps, lists) respects top *and* bottom insets on notched devices so content never sits under the status bar or home indicator.

**9. Empty & loading states.** The redesign nailed the populated states; give the empty states (no deliveries, no earnings, no messages) the same treatment — route-line illustration + a clear CTA — so first-run doesn't feel unfinished.

**10. Motion.** The design is static. A few small touches (the in-transit timeline node pulsing, a subtle confetti animation on Delivered, button press states) would add polish cheaply with `Animated`/Reanimated. Optional, but it's what makes a demo feel alive.

**11. Haptics.** Code-verified pickup/drop-off and the Delivered moment are perfect candidates for a light haptic (`expo-haptics`) — small detail, big perceived quality.

---

## What's working (keep it)

- **The route-line motif** is a genuine brand asset — used consistently across cards, the logo, dividers, and watermarks. This is the strongest part of the identity.
- **Carbon as a recurring thread** (login promise → home card → delivered tally → earnings chip → profile lifetime) is well executed and differentiates the product.
- **Typographic system** — Bricolage display / Hanken body / JetBrains "postal" numerals gives clear hierarchy and personality.
- **Component discipline** — tokenized colors/spacing/shadows mean the whole app moves together; new screens inherit the look for free.

---

## Suggested order of work

1. P0 #1 (contrast token) and P0 #2 (Delivered rating logic) — quick, and both are demo-visible.
2. P1 #3 (ETA) and #6 (font weights) — small, tidy.
3. Everything else post-pilot, prioritizing #4 (real maps) and #9 (empty states) as the next visible wins.

*I can implement the P0 and P1 items now if you'd like — most are small, localized changes.*
