/**
 * Shlep palette — the single source of truth for colour in the app.
 *
 * These values match brand/README.md and the website exactly. They previously
 * drifted: the app carried the older PeerDeliver "spruce" palette while the
 * website moved to forest green with amber as the accent. Someone comparing
 * shlep.ch to the app side by side would have seen two different products.
 *
 *
 * WHY THE GREEN CHANGED
 *
 * The brand green was #14532D. Against the paper background that is a contrast
 * ratio of 7.94 — so dark it reads as near-black rather than as a colour, which
 * is why the app looked grey and unfinished rather than green. Every surface
 * using it lost the brand entirely.
 *
 * It is now #1C6B41: a mid forest that is unmistakably green, while still
 * carrying white text at 6.50 and reading on paper at 5.67. Both comfortably
 * above the 4.5 that WCAG AA asks for, with headroom for the next change.
 *
 * #14532D did not go to waste — it is the pressed/gradient end of the scale,
 * where near-black is exactly what you want.
 *
 *
 * CONTRAST RULES, NOT PREFERENCES
 *
 *  · Amber #E0A32E takes DARK text, always. White on amber is 2.22 — illegible.
 *    Ink on amber is 8.16.
 *  · The eco green was #1F8A5B at 3.78 on paper, below AA as text. Text now
 *    uses impactText #177046 (5.32); #1F8A5B survives only as a fill and a dot,
 *    where contrast rules do not apply.
 *  · primaryLight is a fill for small marks, not a text colour and not a button
 *    background — white on it is 4.88, which is fine for large text only.
 *
 * Every ratio above is computed, not estimated. If you change a value here,
 * recompute rather than trusting your eye: the old green looked fine to
 * everyone who built it.
 */
export const colors = {
  // ── Brand · forest green ──────────────────────────────
  primary: '#1C6B41',       // Forest — primary actions, headers (6.50 on white)
  primaryLight: '#3E7D5E',  // Moss — secondary fills, origin pins
  primaryDark: '#14532D',   // Deep pine — gradients, pressed states
  onPrimary: '#FFFFFF',

  // ── Accent · amber ────────────────────────────────────
  // The brand's signature colour: CTAs, the route line, the logo mark.
  accentAmber: '#E0A32E',
  accentDeep: '#B98114',    // Amber that stays readable as text on paper
  signal: '#E0A32E',        // In-transit, attention, seals
  signalSoft: '#FBEFD7',    // Amber tint — badge backgrounds
  signalText: '#8A5E0C',    // Readable amber on light (4.80 on paper)
  destination: '#C2613C',   // Terracotta — destination pins

  // ── Impact · the carbon story ─────────────────────────
  // Green here MEANS sustainability. Use for any CO₂/eco UI.
  impact: '#1F8A5B',        // Eco green — FILLS and dots only, never text
  impactText: '#177046',    // The same green, dark enough to read (5.32 on paper)
  impactLeaf: '#7FC79B',    // Leaf — icons on dark, celebration
  impactSurface: '#E7F0E9', // Eco card background (matches website)
  impactSurfaceBorder: '#C3DDC9',
  impactOnDark: '#CFEBD8',  // Eco text on dark panels

  // ── Surfaces · paper ──────────────────────────────────
  background: '#F3EFE6',    // Paper — app background
  surface: '#FBFAF4',       // Card — warmer than pure white, as on the site
  surfaceAlt: '#EFEADF',    // Inset rows, sub-panels
  surfaceSunken: '#EBE4D6', // Segmented controls, chips track

  // ── Text · ink ────────────────────────────────────────
  text: '#17160F',          // Ink
  textSecondary: '#57534A',
  // Captions and mono micro-labels. Was #8A867C, a contrast of 3.17 on paper —
  // below AA for normal text, and these ARE normal-size text in several places.
  // #6E6A60 reads at 4.70 and still looks like a quiet label rather than body.
  textLight: '#6E6A60',
  textInverse: '#F3EFE6',   // Paper on dark, not stark white

  // ── Lines ─────────────────────────────────────────────
  border: 'rgba(23,22,15,0.13)',
  borderLight: 'rgba(23,22,15,0.07)',
  routeDash: '#C9BFA9',

  // ── Status ────────────────────────────────────────────
  success: '#177046',
  warning: '#8A5E0C',
  error: '#A33B1F',         // Matches the website's error red
  info: '#2D6F94',

  overlay: 'rgba(23, 22, 15, 0.34)',

  // ── Legacy aliases ────────────────────────────────────
  // Kept so pre-redesign references keep resolving to a sensible new token.
  accent: '#E0A32E',        // → amber, the actual brand accent
  trust: '#2D6F94',         // → info
  card: '#FBFAF4',          // → surface
  primaryLightBg: '#E7F0E9',
} as const;

// Status → token map for delivery states (pending/matched/in_transit/delivered)
//
// Foreground values are the readable variants: amber text on an amber tint is
// what signalText is for, and the matched state uses the new forest rather
// than the old near-black.
export const statusColors = {
  pending:    { bg: '#FBEFD7', fg: '#8A5E0C', dot: '#E0A32E' },
  // Waiting on a person rather than on the world — same marigold as pending,
  // declared explicitly so it does not depend on a fallback.
  offered:    { bg: '#FBEFD7', fg: '#8A5E0C', dot: '#E0A32E' },
  requested:  { bg: '#FBEFD7', fg: '#8A5E0C', dot: '#E0A32E' },
  matched:    { bg: '#E7F0E9', fg: '#1C6B41', dot: '#3E7D5E' },
  in_transit: { bg: '#FBEFD7', fg: '#8A5E0C', dot: '#E0A32E' },
  delivered:  { bg: '#EFEADF', fg: '#57534A', dot: '#C9BFA9' },
} as const;
