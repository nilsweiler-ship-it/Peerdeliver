import Stripe from 'stripe';
import { env } from '../config';
import { AppError } from '../middleware';

let client: Stripe | null = null;

/** True when real Stripe payments are configured (else we use simulated TWINT). */
export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (client) return client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'Stripe not configured (STRIPE_SECRET_KEY missing)');
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  return client;
}
