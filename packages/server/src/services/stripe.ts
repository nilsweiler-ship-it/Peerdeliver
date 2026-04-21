import Stripe from 'stripe';
import { env } from '../config';
import { AppError } from '../middleware';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, 'Payments not configured (STRIPE_SECRET_KEY missing)');
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    typescript: true,
  });
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
