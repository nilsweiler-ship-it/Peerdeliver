export const colors = {
  // ── Brand · spruce green ──────────────────────────────
  primary: '#1F4D3B',       // Spruce — primary actions, headers
  primaryLight: '#3E7D5E',  // Moss — secondary fills, origin pins
  primaryDark: '#163528',   // Deep pine — gradients, pressed states
  onPrimary: '#FFFFFF',

  // ── Signal · marigold + terracotta ───────────────────
  signal: '#E9A23B',        // Marigold — in-transit, attention, seals
  signalSoft: '#FBEFD7',    // Marigold tint — badge backgrounds
  signalText: '#9A6516',    // Readable marigold on light
  destination: '#C2613C',   // Terracotta — destination pins, logout

  // ── Impact · the carbon story ─────────────────────────
  // Green is reserved to MEAN sustainability. Use these for any CO₂/eco UI.
  impact: '#1F8A5B',        // Eco green — figures, online dot
  impactLeaf: '#7FC79B',    // Leaf — icons on dark, celebration
  impactSurface: '#EAF1EB', // Eco card background on light
  impactSurfaceBorder: '#CDE0D1',
  impactOnDark: '#CFEBD8',  // Eco text on spruce gradients

  // ── Surfaces · warm paper ─────────────────────────────
  background: '#F4F0E7',    // Warm paper — app background
  surface: '#FFFFFF',       // Cards
  surfaceAlt: '#FAF7F0',    // Inset rows, sub-panels
  surfaceSunken: '#EBE4D6', // Segmented controls, chips track

  // ── Text ──────────────────────────────────────────────
  text: '#16201B',          // Near-black spruce
  textSecondary: '#6F6A5F', // Warm grey
  textLight: '#A39C8C',     // Captions, mono labels
  textInverse: '#FFFFFF',

  // ── Lines ─────────────────────────────────────────────
  border: '#E8E1D4',        // Card borders
  borderLight: '#F0EADE',   // Inner dividers
  routeDash: '#C9BFA9',     // The dashed route line

  // ── Status ────────────────────────────────────────────
  success: '#1F8A5B',
  warning: '#E9A23B',
  error: '#C2613C',
  info: '#2D6F94',

  overlay: 'rgba(20, 28, 22, 0.34)',

  // ── Legacy aliases ────────────────────────────────────
  // Kept so pre-redesign references keep resolving to a sensible new token.
  accent: '#C2613C',        // → destination (terracotta)
  trust: '#2D6F94',         // → info
  card: '#FFFFFF',          // → surface
} as const;

// Status → token map for delivery states (pending/matched/in_transit/delivered)
export const statusColors = {
  pending:    { bg: '#FBEFD7', fg: '#9A6516', dot: '#E9A23B' },
  matched:    { bg: '#E7EDE7', fg: '#1F6F49', dot: '#3E7D5E' },
  in_transit: { bg: '#FBEFD7', fg: '#9A6516', dot: '#E9A23B' },
  delivered:  { bg: '#EDEAE2', fg: '#6F6A5F', dot: '#C9BFA9' },
} as const;
