# Shlep redesign — implementation brief (for restyling screens)

You are restyling ONE existing screen to the new "Neighbours, moving things forward" design system.
**Preserve ALL logic**: hooks, queries, mutations, navigation calls, state, conditionals, i18n `t()` keys,
socket usage, props. Only change PRESENTATION (JSX wrappers, styles, copy strings where noted, icons).
Do not rename routes or change data flow. Keep the same exported component name and `{ navigation, route }: any` signature.

## Theme tokens — import from `../../theme`
`colors`: primary `#1F4D3B` (spruce), primaryLight `#3E7D5E` (moss), primaryDark `#163528`,
signal `#E9A23B` (marigold), signalSoft, signalText, destination `#C2613C` (terracotta),
impact `#1F8A5B`, impactLeaf, impactSurface, impactSurfaceBorder, impactOnDark,
background `#F4F0E7` (warm paper), surface `#FFF`, surfaceAlt, surfaceSunken,
text `#16201B`, textSecondary, textLight, textInverse,
border, borderLight, routeDash, overlay. Also `statusColors` map.
`typography`: display(34), h1(28), h2(22), h3(17) = Bricolage; body, bodyStrong, bodySmall, caption, button = Hanken;
figure(19), figureLg(40), code(23 ls4), overline(10 uppercase) = JetBrains Mono. Use `typography.figure.fontFamily` for inline mono.
`spacing`: xs4 sm8 md16 lg24 xl32 xxl48. `borderRadius`: sm6 md11 lg14 xl18 xxl22 full. `shadow`: card, sheet.

## RULES
- Screen bg = `colors.background` (paper). Cards = `colors.surface`, radius `borderRadius.xl` (18), 1px `colors.border`, `shadow.card`.
- **All numbers that read as data use mono** (`typography.figure`/`figureLg`/`code` or `fontFamily: typography.figure.fontFamily`):
  CHF amounts, 6-digit codes, tracking IDs (#PD-042851), km, ratings (★ 4.9), dates/times, counts.
- Screen titles = Bricolage via `typography.h1`/`h2`/`display`.
- Wrap screens with `useSafeAreaInsets()` from 'react-native-safe-area-context' and pad top by `insets.top`.
- Icons: `import { Feather } from '@expo/vector-icons'` stroke ~1.8 (Feather is line-based). Ionicons ok too.
- Header pattern: BackChip + Bricolage title + a Pill (e.g. "1 / 3"). Use the brand components below.
- Keep existing `Button`/`Input`/`Card`/`Badge`/`Avatar`/`EmptyState`/`Modal` from `../../components/ui` — they're already restyled.
- Green is reserved for the carbon/impact story (leaf + mono). Spruce is the brand/primary.

## Brand components — import from `../../components/brand`
- `<GradientSurface variant="spruce">…</GradientSurface>` — full-bleed spruce gradient (flex:1). Use for dark screens (login, recipient code, delivered).
- `<RouteWatermark size opacity style />` — absolute low-opacity route graphic for dark surfaces.
- `<RouteLine from to variant="vertical|horizontal" onDark gap />` — origin moss dot → dashed → terracotta ring. `from`/`to` are strings OR `{label, sub}`. Vertical = stacked addresses (cards); horizontal = compact inline row.
- `<StatusBadge status="pending|matched|in_transit|delivered|…" label? dot />` — pill with status dot + colored label (wraps `statusColors`).
- `<ImpactCard amount="23.4 kg" caption="…" sub? variant="light|dark" amountSize? onPress? />` — carbon panel (light = on paper, dark = spruce hero with watermark + chevron). Reuse anywhere CO₂ totals appear.
- `<CO2Chip label="23.4 kg CO₂ saved" onDark? />` — compact leaf + mono chip.
- `<LeafMark size color />`, `<Seal size color />` (postmark), `<BrandMark onDark showWordmark size />` (logo).
- `<MapHeader height={212}>{overlay children}</MapHeader>` — stylized map (mint bg, dashed spruce route, moss origin, terracotta dest, marigold live marker). Overlay back chip / ETA pill as children.
- `<TicketStub title="DELIVERY CODE" locked? footer={<Button/>}>…children…</TicketStub>` — perforated postal stub (marigold header, notch cut line).
- `<CodeBoxes value="0428" length={6} showActive />` — 6 mono code boxes; active box marigold.
- `<Stepper steps={['Package','Address','Budget']} current={1} />` — wizard stepper.
- `<SegmentedControl segments={[{key,label,count?}]} value onChange />` — track surfaceSunken, active white card.
- `<DayPicker value={['mon',…]} onChange />` — 7 square M–S toggles, selected spruce.
- `<Pill label icon? mono? tone="paper|glass|sunken" onDark? onPress? />` — small rounded pill (location chip, "1 / 3", ETA).
- `<BackChip onPress onDark? />` — circular back button.
- `<Confetti />`, `<SuccessMedallion size />` — celebration screen.

## Exemplars already done — read these for the exact patterns/quality bar
- `src/screens/auth/LoginScreen.tsx` (dark gradient screen: GradientSurface + RouteWatermark + Seal + BrandMark + glass Inputs + light Button + CO2Chip)
- `src/screens/shared/HomeScreen.tsx` (paper dashboard: header with mono date + avatar notif dot, stat cards with mono figures, ImpactCard, action-needed card with RouteLine + StatusBadge)

Match their structure, spacing rhythm, and token usage. Output: the fully rewritten screen file only.
