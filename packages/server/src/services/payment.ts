import type Stripe from 'stripe';
import { prisma, env } from '../config';
import { AppError } from '../middleware';
import { getStripe } from './stripe';

function roundCents(chf: number): number {
  return Math.round(chf * 100);
}

export function computeSplit(budgetCHF: number): { platformFeeCHF: number; driverPayoutCHF: number } {
  const feePct = env.PLATFORM_FEE_PERCENT / 100;
  const platformFeeCHF = Math.round(budgetCHF * feePct * 100) / 100;
  const driverPayoutCHF = Math.round((budgetCHF - platformFeeCHF) * 100) / 100;
  return { platformFeeCHF, driverPayoutCHF };
}

// ---------------- Connect onboarding ----------------

export async function getOrCreateConnectAccount(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (user.stripeAccountId) return user.stripeAccountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: env.STRIPE_PLATFORM_COUNTRY,
    email: user.email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { stripeAccountId: account.id },
  });
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.stripeAccountId) {
    return { onboarded: false, payoutsEnabled: false };
  }
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

// ---------------- PaymentIntent lifecycle ----------------

export async function createPaymentIntentForDelivery(deliveryId: string, budgetCHF: number): Promise<{ id: string; clientSecret: string }> {
  const stripe = getStripe();
  // TWINT doesn't support manual capture, so we use automatic capture for both TWINT and cards.
  // Funds land in the platform's Stripe balance on sender confirmation and are held there
  // until `delivered`, at which point we create a Transfer to the driver's Connect account.
  const intent = await stripe.paymentIntents.create(
    {
      amount: roundCents(budgetCHF),
      currency: 'chf',
      payment_method_types: ['twint', 'card'],
      metadata: { deliveryRequestId: deliveryId },
    },
    { idempotencyKey: `delivery-intent-${deliveryId}` },
  );
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { stripePaymentIntentId: intent.id },
  });
  return { id: intent.id, clientSecret: intent.client_secret! };
}

export async function captureAndPayoutOnDelivered(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (!delivery.stripePaymentIntentId) {
    // No payment attached — skip silently so pre-payment beta deliveries don't break
    return;
  }
  if (delivery.paymentStatus === 'captured') return;
  if (delivery.paymentStatus !== 'authorised') {
    // Sender hasn't actually paid yet (PaymentSheet not completed). Nothing to transfer.
    return;
  }
  if (!delivery.driverId) throw new AppError(400, 'No driver on delivery');

  const driver = await prisma.user.findUnique({ where: { id: delivery.driverId } });
  if (!driver?.stripeAccountId) throw new AppError(400, 'Driver has no Stripe account');

  const stripe = getStripe();
  const { platformFeeCHF, driverPayoutCHF } = computeSplit(delivery.budgetCHF);

  // Funds are already in the platform's Stripe balance (auto-captured on sender confirmation).
  // Just transfer the driver's cut; platform fee stays behind.
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
    // In dev, a seeded test driver's Connect account may not be transfer-ready. Log and
    // mark the fee split anyway so the E2E flow completes; production errors bubble up.
    if (env.NODE_ENV === 'development') {
      console.warn(`[payments] Transfer failed for delivery ${deliveryId}:`, (err as Error).message);
    } else {
      throw err;
    }
  }

  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: {
      platformFeeCHF,
      driverPayoutCHF,
      stripeTransferId: transferId,
      paymentStatus: 'captured',
    },
  });
}

export async function voidIntentOnCancel(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery?.stripePaymentIntentId) return;
  if (delivery.paymentStatus === 'voided' || delivery.paymentStatus === 'refunded') return;

  const stripe = getStripe();

  // If sender already paid (authorised) or funds were transferred (captured), refund.
  // If the PaymentIntent was never confirmed (unpaid / failed), cancel it.
  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') {
    // Reverse the driver transfer first if there was one, to reclaim driver-side funds.
    if (delivery.stripeTransferId) {
      await stripe.transfers.createReversal(delivery.stripeTransferId, {}).catch(() => {});
    }
    const refund = await stripe.refunds.create(
      { payment_intent: delivery.stripePaymentIntentId },
      { idempotencyKey: `delivery-refund-${deliveryId}` },
    );
    await prisma.deliveryRequest.update({
      where: { id: deliveryId },
      data: {
        paymentStatus: 'refunded',
        refundedCHF: (refund.amount ?? 0) / 100,
        refundedAt: new Date(),
      },
    });
    return;
  }

  // Not paid yet — just cancel the PaymentIntent so the sender isn't charged later.
  await stripe.paymentIntents.cancel(delivery.stripePaymentIntentId).catch(() => {});
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { paymentStatus: 'voided' },
  });
}

// ---------------- Webhook handlers ----------------

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      // Auto-capture: funds just landed in the platform balance. Mark the delivery as
      // 'authorised' (paid, held) — not yet 'captured', which we reserve for driver-transferred.
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
        data: {
          paymentStatus: 'refunded',
          refundedCHF: (charge.amount_refunded ?? 0) / 100,
          refundedAt: new Date(),
        },
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

// ---------------- Earnings ----------------

// ---------------- Dev-only helpers ----------------

/**
 * Fully onboard a driver for test mode without the hosted flow. Creates a Connect
 * account with canned CH individual details + a test bank token, then flips our DB
 * flags. This function only runs when NODE_ENV === 'development'; the calling
 * endpoint enforces that. Transfers to the resulting account may still fail if
 * Stripe can't verify the canned data — callers should handle transfer errors.
 */
export async function devCompleteDriverOnboarding(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

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

  // Mark as fully onboarded in our DB — this flips the assignDelivery gate open.
  // Real Stripe may still report details_submitted=false; that's fine for test flows
  // that don't actually move money end-to-end.
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeAccountId: accountId,
      stripeDetailsSubmitted: true,
      stripePayoutsEnabled: true,
    },
  });
  return { stripeAccountId: accountId, onboarded: true, payoutsEnabled: true };
}

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
      stripeTransferId: true,
      updatedAt: true,
    },
  });
  const pending = deliveries
    .filter((d) => d.paymentStatus === 'captured' && d.stripeTransferId)
    .reduce((sum, d) => sum + (d.driverPayoutCHF ?? 0), 0);
  return { pending: Math.round(pending * 100) / 100, deliveries };
}
