export const ROLES = {
  SENDER: 'sender',
  DRIVER: 'driver',
  BOTH: 'both',
  RECIPIENT: 'recipient',
  ADMIN: 'admin',
} as const;

export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Values the waitlist form may submit.
 *
 * Defined once because they were previously written out independently in three
 * places — the buttons in website/index.html, the zod enum in the forms
 * controller, and the database column. The markup said `send` and `drive`
 * while the API accepted `sender` and `driver`, so every signup that expressed
 * a preference was rejected with a 400 and lost. Nothing failed loudly; the
 * email fallback returned success and the form said thank you.
 *
 * The website is plain JS with no build step and cannot import this, so
 * scripts/preflight.mjs greps the markup and compares it against this list.
 * That check is the part that actually prevents a recurrence.
 */
export const WAITLIST_ROLES = ['sender', 'driver', 'both'] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number];
