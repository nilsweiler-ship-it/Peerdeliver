export const ROLES = {
  SENDER: 'sender',
  DRIVER: 'driver',
  BOTH: 'both',
  ADMIN: 'admin',
} as const;

export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
