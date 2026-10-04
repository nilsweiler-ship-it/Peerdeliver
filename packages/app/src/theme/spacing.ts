/**
 * The measurement system. Everything that occupies space should come from
 * here, so that "slightly off" stops being possible.
 *
 * A sweep of the screens found padding values of 1, 2, 3, 5, 6, 7, 9, 10, 11
 * and 14 points sitting beside the tokens — each one a decision someone made
 * by eye, none of them agreeing with the next. That is what makes an interface
 * read as prototype-y even when nothing is wrong with it: the eye notices that
 * two cards which look alike are not aligned, long before it can say why.
 */
export const spacing = {
  xxs: 2, // hairline nudges — icon optical alignment, nothing structural
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Corner radii, on a 4pt scale.
 *
 * Was 6 / 11 / 14 / 18 / 22 — arbitrary numbers that could not be reasoned
 * about or nested cleanly. A radius inside another radius should differ by
 * roughly the padding between them, which only works if the steps are regular.
 */
export const borderRadius = {
  sm: 8,    // chips, small tags, inputs
  md: 12,   // nested panels, rows inside a card
  lg: 16,   // buttons
  xl: 20,   // cards
  xxl: 24,  // hero panels, sheets
  full: 9999,
} as const;

/**
 * Elevation, warm-tinted and soft — never hard black shadows on paper.
 *
 * Three levels rather than two: `raised` existed implicitly in several screens
 * as a hand-written shadow between `card` and `sheet`.
 */
export const shadow = {
  card: {
    shadowColor: '#16201B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#16201B',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
} as const;

/**
 * Control heights. Touch targets below 44pt fail Apple's own guidance and are
 * measurably harder to hit; these are the only two sizes the app should use.
 */
export const controlHeight = {
  sm: 44,
  md: 52,
} as const;
