import { Request, Response } from 'express';
import type Stripe from 'stripe';
import { env } from '../config';
import { getStripe, stripeConfigured } from '../services/stripe';
import { paymentService } from '../services';

export async function stripeWebhook(req: Request, res: Response) {
  if (!stripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).send('Webhook not configured');
    return;
  }
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) {
    res.status(400).send('Missing signature');
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a raw Buffer here because the route was mounted with express.raw
    event = getStripe().webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send(`Signature verification failed: ${(err as Error).message}`);
    return;
  }

  try {
    await paymentService.handleStripeEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook handler]', err);
    res.status(500).send('Handler error');
  }
}
