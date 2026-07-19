import type Stripe from 'stripe';
import { prisma, env } from '../config';
import { AppError } from '../middleware';
import { getStripe, stripeConfigured } from './stripe';

/**
 * Payments run in one of two modes:
 *  - REAL: when STRIPE_SECRET_KEY is set — Stripe PaymentIntents (TWINT + card),
 *    Stripe Connect onboarding/payouts, webhooks.
 *  - SIMULATED: otherwise — a self-contained TWINT-style flow with no processor
 *    (so the app/demo works without keys).
 * delivery.ts calls the unified entry points; they dispatch on `stripeConfigured()`.
 */

function roundCents(chf: number): number {
  return Math.round(chf * 100);
}

export function computeSplit(budgetCHF: number): { platformFeeCHF: number; driverPayoutCHF: number } {
  // 9% platform fee with a CHF 1.50 minimum: per-delivery costs (payment
  // processing, insurance, payout rails) are mostly fixed, so small tickets
  // need a floor to stay cost-covering.
  const feePct = env.PLATFORM_FEE_PERCENT / 100;
  const rawFee = Math.max(budgetCHF * feePct, env.PLATFORM_FEE_MIN_CHF);
  const platformFeeCHF = Math.min(Math.round(rawFee * 100) / 100, budgetCHF);
  const driverPayoutCHF = Math.round((budgetCHF - platformFeeCHF) * 100) / 100;
  return { platformFeeCHF, driverPayoutCHF };
}

function makeTwintRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `TW-${stamp}-${rand}`;
}

// ───────────────────────── Stripe Connect (real mode) ─────────────────────────

export async function getOrCreateConnectAccount(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.stripeAccountId) return user.stripeAccountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: env.STRIPE_PLATFORM_COUNTRY,
    email: user.email,
    capabilities: { transfers: { requested: true } },
    metadata: { userId: user.id },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeAccountId: account.id } });
  return account.id;
}

export async function createOnboardingLink(userId: string, refreshUrl: string, returnUrl: string): Promise<string> {
  const accountId = await getOrCreateConnectAccount(userId);
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function refreshConnectStatus(userId: string) {
  // In simulated mode every driver is payout-ready (no real onboarding gate).
  if (!stripeConfigured()) return { onboarded: true, payoutsEnabled: true, simulated: true };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.stripeAccountId) return { onboarded: false, payoutsEnabled: false };

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  const onboarded = Boolean(account.details_submitted);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  await prisma.user.update({
    where: { id: userId },
    data: { stripeDetailsSubmitted: onboarded, stripePayoutsEnabled: payoutsEnabled },
  });
  return { onboarded, payoutsEnabled };
}

export async function devCompleteDriverOnboarding(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!stripeConfigured()) {
    return { onboarded: true, payoutsEnabled: true, simulated: true };
  }
  const stripe = getStripe();
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: env.STRIPE_PLATFORM_COUNTRY,
      email: user.email,
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
      metadata: { userId: user.id, devSeeded: '1' },
    });
    accountId = account.id;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { stripeAccountId: accountId, stripeDetailsSubmitted: true, stripePayoutsEnabled: true },
  });
  return { stripeAccountId: accountId, onboarded: true, payoutsEnabled: true };
}

/** Whether a driver may be assigned (real mode requires completed payout onboarding). */
export async function driverCanReceivePayouts(driverId: string): Promise<boolean> {
  if (!stripeConfigured()) return true;
  const driver = await prisma.user.findUnique({ where: { id: driverId }, select: { stripePayoutsEnabled: true } });
  return Boolean(driver?.stripePayoutsEnabled);
}

// ───────────────────────── Pay-in ─────────────────────────

/**
 * Called when a delivery is created. Real mode: create a TWINT PaymentIntent and
 * return its clientSecret for the app to confirm (app-switch to TWINT). Sim mode:
 * returns null — the sender confirms via POST /payments/twint/pay instead.
 */
export async function createPaymentForDelivery(deliveryId: string, budgetCHF: number): Promise<string | null> {
  if (!stripeConfigured()) return null;
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create(
    {
      amount: roundCents(budgetCHF),
      currency: 'chf',
      // TWINT is the headline Swiss method; card kept as a fallback for testing.
      payment_method_types: ['twint', 'card'],
      metadata: { deliveryRequestId: deliveryId },
    },
    { idempotencyKey: `delivery-intent-${deliveryId}` },
  );
  await prisma.deliveryRequest.update({ where: { id: deliveryId }, data: { stripePaymentIntentId: intent.id } });
  return intent.client_secret;
}

/** SIM mode: sender confirms the (simulated) TWINT payment → authorised. */
export async function payWithTwint(deliveryId: string, senderId: string, phone?: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.senderId !== senderId) throw new AppError(403, 'Not authorized');
  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') return;
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: {
      twintRef: delivery.twintRef ?? makeTwintRef(),
      twintPhone: phone ?? delivery.twintPhone ?? null,
      paymentStatus: 'authorised',
    },
  });
}

// ───────────────────────── Capture / payout on delivery ─────────────────────────

export async function captureAndPayoutOnDelivered(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.paymentStatus === 'captured') return;
  if (delivery.paymentStatus !== 'authorised') return; // sender never paid
  if (!delivery.driverId) throw new AppError(400, 'No driver on delivery');

  const { platformFeeCHF, driverPayoutCHF } = computeSplit(delivery.budgetCHF);

  // REAL: transfer the driver's cut from the platform balance.
  if (stripeConfigured() && delivery.stripePaymentIntentId) {
    const driver = await prisma.user.findUnique({ where: { id: delivery.driverId } });
    if (!driver?.stripeAccountId) throw new AppError(400, 'Driver has no Stripe account');
    const stripe = getStripe();
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: roundCents(driverPayoutCHF),
          currency: 'chf',
          destination: driver.stripeAccountId,
          transfer_group: deliveryId,
          metadata: { deliveryRequestId: deliveryId },
        },
        { idempotencyKey: `delivery-transfer-${deliveryId}` },
      );
      transferId = transfer.id;
    } catch (err) {
      if (env.NODE_ENV === 'development') {
        console.warn(`[payments] Transfer failed for ${deliveryId}:`, (err as Error).message);
      } else {
        throw err;
      }
    }
    await prisma.deliveryRequest.update({
      where: { id: deliveryId },
      data: { platformFeeCHF, driverPayoutCHF, stripeTransferId: transferId, paymentStatus: 'captured' },
    });
    return;
  }

  // SIM: just record the split.
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { platformFeeCHF, driverPayoutCHF, paymentStatus: 'captured' },
  });
}

// ───────────────────────── Cancel ─────────────────────────

export async function voidOnCancel(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) return;
  if (delivery.paymentStatus === 'voided' || delivery.paymentStatus === 'refunded') return;

  // REAL: reverse any transfer + refund the PaymentIntent (or cancel if unpaid).
  if (stripeConfigured() && delivery.stripePaymentIntentId) {
    const stripe = getStripe();
    if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') {
      if (delivery.stripeTransferId) {
        await stripe.transfers.createReversal(delivery.stripeTransferId, {}).catch(() => {});
      }
      const refund = await stripe.refunds.create(
        { payment_intent: delivery.stripePaymentIntentId },
        { idempotencyKey: `delivery-refund-${deliveryId}` },
      );
      await prisma.deliveryRequest.update({
        where: { id: deliveryId },
        data: { paymentStatus: 'refunded', refundedCHF: (refund.amount ?? 0) / 100, refundedAt: new Date() },
      });
      return;
    }
    await stripe.paymentIntents.cancel(delivery.stripePaymentIntentId).catch(() => {});
    await prisma.deliveryRequest.update({ where: { id: deliveryId }, data: { paymentStatus: 'voided' } });
    return;
  }

  // SIM.
  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') {
    await prisma.deliveryRequest.update({
      where: { id: deliveryId },
      data: { paymentStatus: 'refunded', refundedCHF: delivery.budgetCHF, refundedAt: new Date() },
    });
  } else {
    await prisma.deliveryRequest.update({ where: { id: deliveryId }, data: { paymentStatus: 'voided' } });
  }
}

// ───────────────────────── Webhooks (real mode) ─────────────────────────

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const deliveryId = intent.metadata?.deliveryRequestId;
      if (!deliveryId) return;
      await prisma.deliveryRequest.updateMany({
        where: { id: deliveryId, paymentStatus: { in: ['unpaid', 'failed'] } },
        data: { paymentStatus: 'authorised' },
      });
      return;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const deliveryId = intent.metadata?.deliveryRequestId;
      if (!deliveryId) return;
      await prisma.deliveryRequest.updateMany({
        where: { id: deliveryId, paymentStatus: { in: ['unpaid', 'authorised'] } },
        data: { paymentStatus: 'failed' },
      });
      return;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (!intentId) return;
      await prisma.deliveryRequest.updateMany({
        where: { stripePaymentIntentId: intentId },
        data: { paymentStatus: 'refunded', refundedCHF: (charge.amount_refunded ?? 0) / 100, refundedAt: new Date() },
      });
      return;
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const userId = account.metadata?.userId;
      if (!userId) return;
      await prisma.user.updateMany({
        where: { id: userId },
        data: {
          stripeDetailsSubmitted: Boolean(account.details_submitted),
          stripePayoutsEnabled: Boolean(account.payouts_enabled),
        },
      });
      return;
    }
    default:
      return;
  }
}

// ───────────────────────── Earnings (shared) ─────────────────────────

export async function getEarnings(driverId: string) {
  const deliveries = await prisma.deliveryRequest.findMany({
    where: { driverId, driverPayoutCHF: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      budgetCHF: true,
      platformFeeCHF: true,
      driverPayoutCHF: true,
      updatedAt: true,
    },
  });
  const pending = deliveries
    .filter((d) => d.paymentStatus === 'captured')
    .reduce((sum, d) => sum + (d.driverPayoutCHF ?? 0), 0);
  return { pending: Math.round(pending * 100) / 100, deliveries };
}
