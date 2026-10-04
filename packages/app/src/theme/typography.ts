import { TextStyle } from 'react-native';

/**
 * Two families. Previously three.
 *
 *  - Bricolage Grotesque — headings AND body. One voice, from the biggest
 *    headline to the smallest caption.
 *  - IBM Plex Mono — only where monospace does a job: delivery codes, prices,
 *    distances, ratings. Figures that want to line up, and codes that want
 *    their digits unambiguous.
 *
 * IBM Plex Sans is gone. It was doing the same job Bricolage already does, and
 * a reader could not have told you why the app used two sans faces, because
 * there was no reason — the type system had simply accumulated.
 *
 *
 * A NOTE ON BRICOLAGE FOR BODY TEXT
 *
 * Bricolage is a display grotesque: it has personality in the details, which
 * is exactly what you want at 28pt and a risk at 12pt. Two compensations are
 * applied below rather than left to chance:
 *
 *  · body sizes get slightly looser line-height than a neutral face would need
 *    (16/23 rather than 16/22), because the larger x-height closes up lines;
 *  · small sizes get a touch of positive letter-spacing, where display sizes
 *    get negative. Tight tracking is a headline device and actively hurts
 *    legibility at caption size.
 *
 * If running text ever starts to feel effortful, that is the trade-off showing
 * and the fix is a neutral body face — not smaller type.
 */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'BricolageGrotesque_400Regular',
  bodyMedium: 'BricolageGrotesque_500Medium',
  bodySemi: 'BricolageGrotesque_600SemiBold',
  bodyBold: 'BricolageGrotesque_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  // ── Display · Bricolage, tight tracking ───────────────
  display:  { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  h1:       { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  h2:       { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  h3:       { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },

  // ── Body · Bricolage, neutral to slightly open tracking ───
  body:        { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong:  { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  bodySmall:   { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  caption:     { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, letterSpacing: 0.2 },
  button:      { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.1 },

  // ── Mono · figures that line up, codes that cannot be misread ───
  figure:     { fontFamily: fonts.monoBold, fontSize: 19, lineHeight: 23 },
  figureLg:   { fontFamily: fonts.monoBold, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  code:       { fontFamily: fonts.monoBold, fontSize: 23, lineHeight: 27, letterSpacing: 4 },
  // Uppercase mono micro-label: pair with colour textLight
  overline:   { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1 },
} as const;
