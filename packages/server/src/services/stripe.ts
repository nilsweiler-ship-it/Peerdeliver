import Stripe from 'stripe';
import { env } from '../config';
import { AppError } from '../middleware';

let client: Stripe | null = null;

/** True when real Stripe payments are configured (else we use simulated TWINT). */
export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** True when the key moves real money (sk_live_ / rk_live_), as opposed to test mode. */
export function stripeIsLive(): boolean {
  return /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? '');
}

/**
 * Whether the dev shortcuts (dev-verify-all, dev-complete) exist at all.
 *
 * Only when someone asked for them by name: ENABLE_DEV_ENDPOINTS=true, and
 * never with a live Stripe key. NODE_ENV is not enough — it defaults to
 * 'development' when unset, so a deploy that forgot it (or a pilot running
 * on test keys) served an endpoint that marks any account fully verified.
 */
export function devEndpointsEnabled(): boolean {
  return process.env.ENABLE_DEV_ENDPOINTS === 'true' && !stripeIsLive();
}

export function getStripe(): Stripe {
  if (client) return client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'Stripe not configured (STRIPE_SECRET_KEY missing)');
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}
