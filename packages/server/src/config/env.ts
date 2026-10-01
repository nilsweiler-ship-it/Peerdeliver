import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PLATFORM_FEE_PERCENT: z.coerce.number().default(9),
  PLATFORM_FEE_MIN_CHF: z.coerce.number().default(1.5),
  // Real payments via Stripe (TWINT + card). Leave unset to use simulated TWINT.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PLATFORM_COUNTRY: z.string().default('CH'),
  // Partner integrations (marketplace checkout widget).
  // Publishable, read-only keys as `name:key` pairs, comma separated.
  PARTNER_API_KEYS: z.string().default(''),
  PARTNER_DEEPLINK_BASE: z.string().default('https://shlep.ch'),
  PARTNER_MAX_DISTANCE_KM: z.coerce.number().default(150),
  // Transactional email (Resend). Unset = emails are logged, not sent.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Shlep <hello@shlep.ch>'),
  EMAIL_INTERNAL_TO: z.string().default('hello@shlep.ch'),
  // SMS one-time codes (Twilio Verify). Unset = codes are logged, not sent,
  // and any 6-digit code is accepted — dev convenience, never in production.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  // Real TWINT payments via Payrexx (Swiss PSP). Takes money from the sender;
  // driver payouts stay with Stripe Connect — see services/payrexx.ts.
  PAYREXX_INSTANCE: z.string().optional(),
  PAYREXX_API_SECRET: z.string().optional(),
  PAYREXX_WEBHOOK_SECRET: z.string().optional(),
  // Where Payrexx sends the payer back after the hosted page.
  PAYREXX_RETURN_BASE: z.string().default('https://shlep.ch'),
});

/**
 * Parse, and when it fails say which variable and what is wrong with it.
 *
 * A raw ZodError prints a fifty-line stack trace in which the useful content
 * is one word. Worse, the most common cause by far is a placeholder pasted
 * verbatim out of documentation or a chat message — `<external url>`,
 * `sk_test_…`, `postgresql://…` — which has cost this project hours more than
 * once, including an ellipsis that failed as a *network* error because U+2026
 * is not valid in an HTTP header.
 *
 * So placeholders are detected by shape and named as such.
 */
function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const lines = result.error.issues.map((i) => {
    const key = String(i.path[0]);
    const raw = process.env[key] ?? '';
    const looksLikePlaceholder =
      /[<>]/.test(raw) || /[…]/.test(raw) || /\.\.\.$/.test(raw) || raw === '.env';
    const detail = looksLikePlaceholder
      ? `looks like a placeholder, not a real value: "${raw.slice(0, 40)}"`
      : i.message;
    return `  ${key}: ${detail}`;
  });

  console.error(
    `\n\x1b[31mEnvironment is not usable.\x1b[0m\n\n${lines.join('\n')}\n\n` +
      '  Values come from packages/server/.env, or from the shell for a one-off run.\n',
  );
  process.exit(1);
}

export const env = parseEnv();
