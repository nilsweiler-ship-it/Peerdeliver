export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Rounder, friendlier corners than the old kit (cards 18, pills full).
export const borderRadius = {
  sm: 6,
  md: 11,
  lg: 14,
  xl: 18,
  xxl: 22,
  full: 9999,
} as const;

// Soft, warm-tinted elevation — never hard black shadows.
export const shadow = {
  card: {
    shadowColor: '#16201B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
} as const;
