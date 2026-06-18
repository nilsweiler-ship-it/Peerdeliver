# Handoff: PeerDeliver Visual Redesign

## Overview
A full visual redesign of PeerDeliver — the Swiss peer-to-peer parcel network (senders, drivers, recipients; CHF, Zürich region). It replaces the generic kelly-green system with a distinctive **"Neighbours, moving things forward"** identity and brings the carbon-savings value proposition forward as a first-class, recurring element. This package covers the **core flow end-to-end (14 screens)** plus refreshed design tokens and base components.

## About the Design Files
The files in `reference/` are **design references created in HTML** (`PeerDeliver.dc.html` — a horizontally-scrolling board of all 14 screens inside iOS device frames). They are prototypes showing the intended look and behavior — **not production code to copy directly**.

Your task is to **recreate these designs in the existing React Native / Expo app** (`packages/app`), using its established patterns: `StyleSheet.create`, the `theme/` tokens, React Navigation, the `components/ui` + `components/delivery` + `components/route` primitives. Do **not** port HTML/CSS or introduce web-only constructs.

`PeerDeliver.dc.html` is a custom HTML component format — to view it, open it in the design tool. The visual content is what matters; ignore the `<x-import>`/`support.js` machinery.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and layout. Recreate pixel-faithfully using the RN tokens. Exact hex values, font families, and sizes are specified in **Design Tokens** below and already encoded in `theme/`.

## Already-Updated Source (drop-in)
These files were updated to the new system and are included under `theme/` and `components/` — copy them to the matching paths in `packages/app/src/`:
- `theme/colors.ts` — new palette + `statusColors` map + dedicated **impact** (carbon) tokens
- `theme/typography.ts` — Bricolage Grotesque (display) / Hanken Grotesk (body) / JetBrains Mono (figures) + `fonts` map
- `theme/spacing.ts` — spacing, `borderRadius`, new `shadow` tokens
- `theme/index.ts` — barrel exports
- `components/Button.tsx`, `Badge.tsx`, `Card.tsx` — restyled to the new tokens

### Required setup (fonts)
The type system needs three Google font families. Install and load before first render:
```bash
npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/hanken-grotesk @expo-google-fonts/jetbrains-mono expo-font
```
Load weights in `App.tsx` with `useFonts`: Bricolage 600/700, Hanken 400/500/600/700, JetBrains Mono 500/700. The family names map to `fonts` in `theme/typography.ts`.

## Design Language (apply everywhere)
1. **Route line motif** — the signature graphic. Origin = filled moss dot (`primaryLight`), destination = hollow terracotta ring (`destination`), connected by a **2px dashed line** (`routeDash`, vertical between stacked addresses, horizontal in compact rows). Used in cards, the logo, dividers, and as a large low-opacity background watermark on dark surfaces.
2. **Postmark seal** — circular dashed stamp with the route motif inside; used as a brand accent (login, earnings watermark).
3. **Postal numerals** — all numbers that read as "data" use JetBrains Mono: CHF amounts, the 6-digit codes, tracking IDs (`#PD-042851`), km, ratings (`★ 4.9`), dates.
4. **Green means impact.** Spruce green is the brand/primary color, but the **eco-green impact tokens** are reserved to signal carbon savings — leaf icon + mono figure, appearing at Login (promise), Home (daily card), Delivered (per-trip tally), Earnings (chip), and Profile (lifetime total).
5. **Ticket-stub** — verification-code cards use a perforated edge (notch circles + dashed cut line) like a postal stub.

## Screens / Views
Screen numbers match the `data-screen-label` on each frame in the HTML.

### 01 — Sign in
- **Purpose:** Brand moment + email/password login.
- **Layout:** Full-bleed spruce gradient (`#235440 → #1A3E2F → #0F291E`), 32px h-padding. Large route-line watermark top-right at 10% opacity. Top row: mono "EST. ZÜRICH · CH" + small marigold seal. Brand mark, then display headline "Send it with someone already going there." (Bricolage 700, 40px, -1px tracking, white), subcopy (Hanken 16px, white 62%), and a **"LOW-CARBON BY DESIGN" pill** (impact-leaf token). Bottom: two glass inputs (email, password) + paper-colored "Log in" button + "Create an account" link (marigold).
- **Inputs:** translucent white fill `rgba(255,255,255,0.07)`, 1px border `rgba(255,255,255,0.16)`, radius 14, mono uppercase labels.

### 02 — Home
- **Purpose:** Sender + driver dashboard.
- **Layout:** Paper bg. Header: mono date + "Grüezi, Lena" (Bricolage 700, 28px, `nowrap`) and avatar (46px circle, spruce, marigold notification dot). Body stack (16px gap):
  - **3 stat cards** (flex row, gap 10): Active deliveries `2`, Active route `1`, Unread messages `3` (last in terracotta). White, 1px border, radius 16, mono figure 27px.
  - **Impact card** — `impactSurface` bg, `impactSurfaceBorder` border, radius 16: spruce circle w/ leaf icon, "**23.4 kg** CO₂ saved this year" + "≈ 14 car trips never made", chevron in `impact` green.
  - **Primary CTA** "Create delivery request" (spruce, white, plus icon).
  - **Action-needed card** — white, 1.5px marigold border, marigold-tinted shadow: "ACTION NEEDED" badge + "CHF 24" (mono); route line (Langstrasse 84, Zürich → Bahnhofstr. 21, Winterthur); driver row (avatar MB, "Marco Brunner", mono "★ 4.9 (212) · VW Caddy Maxi"); Decline (outline) + "Accept driver" (spruce) buttons.
  - **Active route card** — ACTIVE + RECURRING badges; horizontal route row Zürich HB → Oerlikon.
- **Tab bar:** 5 tabs (Home active spruce, Shipments, Routes, Chat, Profile). White, 1px top border, line icons, 44px+ targets.

### 03 — Create request
- **Purpose:** Step 1 of 3 — package details.
- **Layout:** Back chip + "New request" (Bricolage 22px) + "1 / 3" pill. **Stepper:** 3 nodes (1 active spruce-filled, 2/3 hollow), connected by 2px lines; labels Package / Address / Budget. Body: "Package size" segmented **S / M / L** cards (M selected = spruce border + `#ECF1EC` fill, box-of-increasing-size icons); "What are you sending?" text field ("A pair of ski boots"); Weight (kg) + Value (CHF) mono fields. Footer: "Continue →" (spruce).

### 04 — Find deliveries (driver)
- **Purpose:** Browse available nearby jobs + detail sheet.
- **Layout:** "Available nearby" (Bricolage 26px) + location pill ("Zürich · 100 km radius", terracotta pin). Two job cards: PENDING badge + CHF (mono), route line, size/contents + "X km away" pill. **Bottom sheet** overlaid (scrim `overlay` token, sheet radius 28 top, grab handle): title "Ski boots · Medium" + CHF 24, delivery window, detail rows (Pickup/Delivery/Distance/Sender rating — labels grey, values mono where numeric), "Request delivery →" CTA.

### 05 — Active delivery (driver)
- **Purpose:** Driver's in-transit view + confirm delivery with code.
- **Layout:** **Stylized map header** (212px): mint bg, white road grid, dashed spruce route path, moss origin dot, terracotta destination ring, marigold position marker; back chip + "ETA 14:25" pill. Body: 5-node **status timeline** (Matched/Accepted/Picked up done, In transit active w/ ring halo, Delivered pending); route-line card; **ticket-stub delivery-code card** — marigold header ("DELIVERY CODE" + lock icon), perforated cut, 6 code boxes (4 filled, 1 active marigold border, 1 empty), "Confirm delivery" CTA.

### 06 — Earnings (driver)
- **Purpose:** Payout summary + history.
- **Layout:** "Earnings" (Bricolage 26px). **Hero balance card** — spruce gradient, route watermark: mono "Pending payout", "CHF 142.20" (mono 40px), payout schedule line, **CO₂-saved chip** (impact-leaf tokens, "23.4 kg CO₂ saved"). **This-week card:** title + CHF 312, 7-bar weekly chart (bars escalate `#DCE7DD → #3E7D5E → #1F4D3B`), M–S mono labels. Recent payouts list: mono amount + status chip (CAPTURED green / AUTHORISED amber), "Budget / Fee" breakdown, mono date · city.

### 07 — Create account
- **Purpose:** Registration + role select.
- **Layout:** Back chip + "Step 2 / 2" pill. "How will you use PeerDeliver?" (Bricolage 28px). Two **role cards**: "I want to send" (selected — spruce border, box icon, filled check) and "I want to drive & earn" (terracotta van icon, empty radio). Full-name field + terms checkbox (spruce, checked). "Create account →" CTA.

### 08 — My shipments (sender)
- **Purpose:** List of sender's deliveries.
- **Layout:** "My shipments" (Bricolage 26px) + segmented **Active 2 / Delivered 14** (track `surfaceSunken`, active = white card). Cards: status dot + badge (IN TRANSIT amber / MATCHED green) + mono tracking id; route line; divider; footer (driver+ETA or pickup window) with "Track →" / "Details →". A dimmed DELIVERED card (62% opacity, grey dots).

### 09 — Track (sender)
- **Purpose:** Sender follows an in-transit parcel.
- **Layout:** Taller map header (248px, same motif). **Driver card** overlapping map by -26px (radius 20, soft shadow): avatar + name + mono "★ 4.9 · VW Caddy Maxi · ZH·428·119" + call (mint) / chat (spruce) circular buttons; divider; 3-step mini progress (Picked up done / In transit active marigold / Delivered pending — mono timestamps). **Code reminder** marigold card: "Recipient's delivery code" + mono "042851" (letter-spacing 5).

### 10 — Publish route (driver)
- **Purpose:** Driver advertises a recurring trip.
- **Layout:** Back chip + "Publish a route" (Bricolage 22px). From/To route-line card (mono micro-labels). **Day picker:** 7 square toggles M–F selected spruce, S/S off white. Departs (mono "07:45") + Capacity ("Up to L") fields. **Detour slider:** "up to 8 km" with spruce track fill (55%) + white knob (3px spruce border). "Publish route →" CTA.

### 11 — Recipient code
- **Purpose:** Recipient presents code to driver on arrival.
- **Layout:** Spruce gradient, route watermark bottom-left. Centered: mono "INCOMING DELIVERY", "Your parcel is almost here" (Bricolage 27px white), subcopy. **Large ticket-stub** (paper card, side notches): "DELIVERY CODE", mono **"042851"** at 46px / letter-spacing 9, "Valid until 14:25" green pill. Driver glass row (avatar, name, mono "★ 4.9 · arriving in ~4 min", marigold call button). Footer safety note.

### 12 — Chat
- **Purpose:** Sender ↔ driver messaging, scoped to a shipment.
- **Layout:** White header (back, avatar, name, mono "● Online · #PD-042851", call button). Message stream: centered day-divider pill; centered system pill "Marco accepted your delivery" (leaf icon); incoming bubbles (white, border, radius `16 16 16 5`); outgoing bubbles (spruce, white text, radius `16 16 5 16`, "Read" receipt mono). **Quick-reply chips** row ("On my way 👋", "Running late", "Thanks!"). Input pill + spruce send button (46px).

### 13 — Delivered 🎉 (celebration)
- **Purpose:** Success moment + per-trip carbon tally + rate driver.
- **Layout:** Spruce gradient, route watermark, scattered confetti dots (marigold/leaf/white). Centered: **success medallion** (108px ring → 78px leaf-green disc → check), "Delivered!" (Bricolage 34px), drop summary line. **Impact panel:** leaf icon + mono **"1.8 kg"** (34px) + "CO₂ saved on this trip" + "Because Marco was already driving this way." Rating row (4.5 marigold stars). "Submit rating" paper button.
- **Note:** This is the celebration moment requested — it ties the carbon payoff to the individual delivery.

### 14 — Profile
- **Purpose:** Identity, lifetime impact, account settings.
- **Layout:** Avatar (64px) + name (Bricolage 22px) + mono "★ 4.8 · Member since 2024" + settings gear. Sender/Driver segmented control. **Lifetime impact card** — spruce gradient, route watermark: leaf + mono "LIFETIME IMPACT", **"86.2 kg"** (mono 38px) + "≈ 52 car trips never made", 3 inner stats (Deliveries 38 / km shared 612 / Neighbours 19). Settings list (Payment & payouts, Verification & trust w/ VERIFIED chip, Help & support). "Log out" (terracotta).

## Interactions & Behavior
- **Navigation:** bottom tabs (Home / Shipments / Routes / Chat / Profile). Create request = 3-step wizard (Package → Address → Budget) with progress + Continue/Back. Register = 2 steps with role select.
- **Driver match flow:** Home "ACTION NEEDED" card → Accept driver / Decline. Find deliveries → tap card → bottom sheet → Request delivery.
- **Code verification:** driver enters recipient's 6-digit code on screen 05 (active box highlighted marigold as they type); recipient shows code on screen 11; sender sees the same code on screen 09.
- **Delivered:** on confirmation, transition to screen 13 (confetti + per-trip CO₂); rating submit returns to list.
- **Status progression:** pending → matched → in_transit → delivered (drives badge color + dot via `statusColors`).
- **Bottom sheet:** slide up over scrim; grab handle; tap scrim to dismiss.
- **Chat:** quick-reply chips insert text; send button posts; read receipts.
- **Map:** these are stylized static maps. If integrating a real map (e.g. react-native-maps), keep the route-line styling — moss origin, terracotta destination, dashed spruce path, marigold live marker.

## State Management
- `role: 'sender' | 'driver'` (toggle persists; most users do both)
- `delivery.status: 'pending' | 'matched' | 'in_transit' | 'delivered'`
- Create-request wizard: `{ step, size, contents, weightKg, valueChf, pickup, dropoff, budgetChf }`
- Route publish: `{ from, to, days[], departTime, capacity, maxDetourKm }`
- Delivery code: 6-char entry state + validation against backend
- Carbon: per-delivery `co2SavedKg`, plus aggregates `co2ThisYear`, `co2Lifetime` (display in JetBrains Mono)
- Data fetching: available deliveries (geo radius), my shipments, earnings/payouts, chat messages (per shipment id), profile stats

## Design Tokens
**Colors** (full set in `theme/colors.ts`):
- Brand: primary `#1F4D3B`, primaryLight `#3E7D5E`, primaryDark `#163528`
- Signal: signal `#E9A23B`, signalSoft `#FBEFD7`, signalText `#9A6516`, destination `#C2613C`
- **Impact (carbon):** impact `#1F8A5B`, impactLeaf `#7FC79B`, impactSurface `#EAF1EB`, impactSurfaceBorder `#CDE0D1`, impactOnDark `#CFEBD8`
- Surfaces: background `#F4F0E7`, surface `#FFFFFF`, surfaceAlt `#FAF7F0`, surfaceSunken `#EBE4D6`
- Text: text `#16201B`, textSecondary `#6F6A5F`, textLight `#A39C8C`
- Lines: border `#E8E1D4`, borderLight `#F0EADE`, routeDash `#C9BFA9`
- `statusColors` map for pending/matched/in_transit/delivered (bg/fg/dot)

**Typography** (`theme/typography.ts`): Bricolage Grotesque (display 34 / h1 28 / h2 22 / h3 17), Hanken Grotesk (body 16 / bodySmall 14 / caption 12 / button 16), JetBrains Mono (figureLg 40 / figure 19 / code 23 ls4 / overline 10 ls1 uppercase).

**Spacing** (`theme/spacing.ts`): xs4 sm8 md16 lg24 xl32 xxl48.
**Radius:** sm6 md11 lg14 xl18 xxl22 full. Cards xl(18), pills full, code boxes md(11).
**Shadow:** `shadow.card` (warm, y4 blur12 6%), `shadow.sheet` (y-12 blur40 18%).

## Assets
- All icons are inline SVG line icons in the reference (tab bar, settings rows, call/chat, lock, leaf, star, van, box). Replace with the codebase's existing icon set (e.g. `@expo/vector-icons` — Feather/Ionicons) matching stroke ~1.8.
- The **brand mark, postmark seal, route-line graphic, and confetti** are custom SVG — recreate as small RN SVG components (`react-native-svg`). The leaf and route-line motif should become reusable components (`<RouteLine from to />`, `<LeafMark />`).
- Stylized maps are SVG placeholders — swap for real map tiles if/when integrating.
- No raster image assets are required.

## Files
- `reference/PeerDeliver.dc.html` — all 14 screens (open in the design tool; scroll horizontally)
- `reference/ios-frame.jsx`, `reference/support.js` — preview scaffolding only; **ignore for implementation**
- `theme/*.ts` — drop-in token files → `packages/app/src/theme/`
- `components/*.tsx` — restyled base components → `packages/app/src/components/ui/`

## Suggested order
1. Install fonts + load in `App.tsx`; drop in `theme/` files.
2. Build reusable motif components: `RouteLine`, `LeafMark`, `Seal`, `StatusBadge` (wraps `statusColors`).
3. Drop in restyled `Button`/`Badge`/`Card`; restyle `DeliveryCard`, `RouteCard`, `StatusTimeline` to match screens 02/04/05.
4. Screen-by-screen, in flow order (01→14). Hero screens first: Home (02), Active delivery (05), Delivered (13).
