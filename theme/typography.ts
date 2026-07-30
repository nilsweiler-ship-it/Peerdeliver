import { TextStyle } from 'react-native';

/**
 * Three families:
 *  - display  → Bricolage Grotesque (headlines, screen titles, numbers-as-statements)
 *  - body     → Hanken Grotesk (all UI / running text)
 *  - mono     → JetBrains Mono ("postal" figures: CHF, codes, tracking IDs, km, ratings)
 *
 * Load via expo-font / @expo-google-fonts in App.tsx, then set these family names.
 */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  // Display — Bricolage
  display:  { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.5 },
  h1:       { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.5 },
  h2:       { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  h3:       { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 22 },

  // Body — Hanken
  body:        { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyStrong:  { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  bodySmall:   { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  caption:     { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  button:      { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20 },

  // Mono — JetBrains ("postal" numerals + technical labels)
  figure:     { fontFamily: fonts.monoBold, fontSize: 19, lineHeight: 22 },
  figureLg:   { fontFamily: fonts.monoBold, fontSize: 40, lineHeight: 42, letterSpacing: -1 },
  code:       { fontFamily: fonts.monoBold, fontSize: 23, lineHeight: 26, letterSpacing: 4 },
  // Uppercase mono micro-label: pair with letterSpacing & color textLight
  overline:   { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1 },
} as const;
