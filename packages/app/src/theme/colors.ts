/**
 * Shlep palette — the single source of truth for colour in the app.
 *
 * These values match brand/README.md and the website exactly. They previously
 * drifted: the app carried the older PeerDeliver "spruce" palette (#1F4D3B
 * green, #F4F0E7 paper, white cards) while the website and brand assets moved
 * to forest green #14532D with amber #E0A32E as the accent. Someone comparing
 * shlep.ch to the app side by side would have seen two different products.
 *
 * Contrast rule worth keeping: amber #E0A32E takes DARK text, never white.
 * For a solid button with white text use forest green.
 */
export const colors = {
  // ── Brand · forest green ──────────────────────────────
  primary: '#14532D',       // Forest green — primary actions, headers
  primaryLight: '#3E7D5E',  // Moss — secondary fills, origin pins
  primaryDark: '#0E3A1F',   // Deep pine — gradients, pressed states
  onPrimary: '#FFFFFF',

  // ── Accent · amber ────────────────────────────────────
  // The brand's signature colour: CTAs, the route line, the logo mark.
  accentAmber: '#E0A32E',
  accentDeep: '#B98114',    // Amber that stays readable as text on paper
  signal: '#E0A32E',        // In-transit, attention, seals
  signalSoft: '#FBEFD7',    // Amber tint — badge backgrounds
  signalText: '#B98114',    // Readable amber on light
  destination: '#C2613C',   // Terracotta — destination pins

  // ── Impact · the carbon story ─────────────────────────
  // Green here MEANS sustainability. Use for any CO₂/eco UI.
  impact: '#1F8A5B',        // Eco green — figures, online dot
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
  textLight: '#8A867C',     // Captions, mono labels
  textInverse: '#F3EFE6',   // Paper on dark, not stark white

  // ── Lines ─────────────────────────────────────────────
  border: 'rgba(23,22,15,0.13)',
  borderLight: 'rgba(23,22,15,0.07)',
  routeDash: '#C9BFA9',

  // ── Status ────────────────────────────────────────────
  success: '#1F8A5B',
  warning: '#E0A32E',
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
export const statusColors = {
  pending:    { bg: '#FBEFD7', fg: '#B98114', dot: '#E0A32E' },
  matched:    { bg: '#E7F0E9', fg: '#14532D', dot: '#3E7D5E' },
  in_transit: { bg: '#FBEFD7', fg: '#B98114', dot: '#E0A32E' },
  delivered:  { bg: '#EFEADF', fg: '#57534A', dot: '#C9BFA9' },
} as const;
