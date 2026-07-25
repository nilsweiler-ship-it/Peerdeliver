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
});

export const env = envSchema.parse(process.env);
