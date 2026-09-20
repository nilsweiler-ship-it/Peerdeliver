import type Stripe from 'stripe';
import { prisma, env } from '../config';
import { AppError } from '../middleware';
import { getStripe, stripeConfigured } from './stripe';
import * as deliveryService from './delivery';
import { splitBudget } from '@peerdeliver/shared';

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
  //
  // The arithmetic itself moved to @peerdeliver/shared so it can be tested
  // adversarially without booting a server or a database — see
  // scripts/payment-battle.mjs.
  //
  // The previous version here was correct on rounding (checked: zero drift
  // across every amount from CHF 0 to CHF 500) but passed hostile input
  // straight through: computeSplit(NaN) returned NaN for both sides,
  // Infinity returned an infinite fee, and a negative budget returned a
  // negative fee. Any of those reaching stripe.transfers.create is an API
  // error raised mid-delivery, with a driver already holding the parcel.
  return splitBudget(budgetCHF, {
    percent: env.PLATFORM_FEE_PERCENT,
    minCHF: env.PLATFORM_FEE_MIN_CHF,
  });
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
  // Prefill everything Shlep already knows. Stripe's hosted onboarding shows
  // prefilled values for confirmation rather than asking again, so each field
  // sent here is one fewer thing a driver has to type — and this form is the
  // most likely place to lose someone who signed up to earn CHF 60 carrying a
  // sofa. We previously sent only the email, so drivers re-entered a name and
  // a phone number we had already collected and verified.
  //
  // What cannot be prefilled away: date of birth, residential address, ID and
  // bank details. That is Stripe performing KYC as the regulated party — which
  // is precisely what keeps Shlep an intermediary rather than a financial
  // intermediary. Collecting a driver's IBAN ourselves would undo that.
  const account = await stripe.accounts.create({
    type: 'express',
    country: env.STRIPE_PLATFORM_COUNTRY,
    email: user.email,
    business_type: 'individual',
    individual: {
      first_name: user.firstName,
      last_name: user.lastName,
      // Already verified by us via Twilio, and stored in E.164.
      ...(user.phone ? { phone: user.phone } : {}),
      ...(user.email ? { email: user.email } : {}),
    },
    business_profile: {
      // MCC 4215 — courier services. Set explicitly so Stripe does not ask the
      // driver to classify their own "business", a question that makes no
      // sense to someone giving a parcel a lift.
      mcc: '4215',
      url: 'https://shlep.ch',
      product_description: 'Occasional parcel delivery on trips already being made',
    },
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
  // Tell the recipient a parcel is coming. Done here rather than at creation so
  // a delivery abandoned at payment never emails anyone.
  void deliveryService.announceToRecipient(deliveryId);
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

    // A budget at or below the fee floor leaves the driver nothing, and Stripe
    // rejects a zero-amount transfer. Refusing here turns an API error raised
    // after a completed handover into a refusal at delivery creation time.
    // (payment-battle.mjs 2.2 confirms Stripe's side of this.)
    const payoutCents = roundCents(driverPayoutCHF);
    if (payoutCents <= 0) {
      throw new AppError(
        400,
        `Delivery ${deliveryId} would pay the driver nothing (budget ${delivery.budgetCHF} CHF is at or below the platform fee floor)`,
      );
    }

    const stripe = getStripe();
    let transferId: string | null = null;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: payoutCents,
          currency: 'chf',
          destination: driver.stripeAccountId,
          transfer_group: deliveryId,
          metadata: { deliveryRequestId: deliveryId },
        },
        // Two concurrent captures of the same delivery — a retried webhook, a
        // double-tapped verify — resolve to one transfer.
        { idempotencyKey: `delivery-transfer-${deliveryId}` },
      );
      transferId = transfer.id;
    } catch (err) {
      // Previously this swallowed the error in development and then fell
      // through to mark the delivery 'captured' with a null transfer id — the
      // driver saw a completed payout that had never happened, which is the
      // same false success the e2e script used to print.
      //
      // Leave the delivery 'authorised': the sender has paid, the driver has
      // not been paid, and that is exactly what the row now says. The split is
      // recorded so the amount owed is visible, and the idempotency key makes
      // a later retry safe — it cannot produce a second transfer.
      console.error(`[payments] Transfer failed for ${deliveryId}:`, (err as Error).message);
      await prisma.deliveryRequest.update({
        where: { id: deliveryId },
        data: { platformFeeCHF, driverPayoutCHF },
      });
      throw err;
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
      // Claw the driver's cut back BEFORE refunding the sender, and refund
      // only what we actually recovered plus what never left.
      //
      // This used to be `.catch(() => {})` followed by an unconditional full
      // refund. A reversal fails for an ordinary reason — the driver has
      // already cashed out, so the connected balance is empty — and the old
      // code then refunded the sender in full anyway, silently eating the
      // payout. payment-battle.mjs 2.5 reproduces it end to end.
      //
      // Honest scope: this state is not currently reachable. A transfer only
      // exists once the delivery is 'delivered', and DELIVERY_STATUS_TRANSITIONS
      // allows nothing out of 'delivered', so no cancellation can arrive after
      // a payout today. The guard is here because that is one transition-table
      // edit away from being false, and the failure is silent when it happens.
      let recoveredCHF = 0;
      let reversalFailed: string | null = null;
      if (delivery.stripeTransferId) {
        try {
          const reversal = await stripe.transfers.createReversal(
            delivery.stripeTransferId,
            {},
            { idempotencyKey: `delivery-reversal-${deliveryId}` },
          );
          recoveredCHF = (reversal.amount ?? 0) / 100;
        } catch (err) {
          reversalFailed = (err as Error).message;
        }
      }

      if (reversalFailed) {
        // Refund what is unambiguously ours to refund: the platform fee, which
        // never left our balance. The driver's cut is now a debt to chase, not
        // a number to quietly absorb — and refusing to guess keeps the sender
        // from being told a full refund is on its way when it is not.
        console.error(
          `[payments] Reversal failed for ${deliveryId} (transfer ${delivery.stripeTransferId}): ${reversalFailed}. ` +
            `Refunding the platform fee only; ${delivery.driverPayoutCHF ?? '?'} CHF is still with the driver.`,
        );
      }

      const refundableCHF = reversalFailed
        ? Math.max(0, delivery.budgetCHF - (delivery.driverPayoutCHF ?? 0))
        : delivery.budgetCHF;

      if (refundableCHF <= 0) {
        await prisma.deliveryRequest.update({
          where: { id: deliveryId },
          data: { refundedCHF: 0, refundedAt: new Date() },
        });
        return;
      }

      const refund = await stripe.refunds.create(
        { payment_intent: delivery.stripePaymentIntentId, amount: roundCents(refundableCHF) },
        { idempotencyKey: `delivery-refund-${deliveryId}` },
      );
      const refundedCHF = (refund.amount ?? 0) / 100;

      await prisma.deliveryRequest.update({
        where: { id: deliveryId },
        data: {
          // A partial refund is not a refunded delivery. Leaving it 'captured'
          // keeps it visible as unfinished rather than filing it as resolved.
          paymentStatus: reversalFailed ? delivery.paymentStatus : 'refunded',
          refundedCHF,
          refundedAt: new Date(),
        },
      });
      if (!reversalFailed && recoveredCHF > 0) {
        console.log(`[payments] ${deliveryId} cancelled: recovered ${recoveredCHF} CHF, refunded ${refundedCHF} CHF`);
      }
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
      // The real per-delivery figure, computed from distance and packaging when
      // the delivery completed. The earnings screen used to multiply the
      // delivery count by a flat 2.6 kg because this was never sent.
      co2SavedKg: true,
      updatedAt: true,
    },
  });
  const pending = deliveries
    .filter((d) => d.paymentStatus === 'captured')
    .reduce((sum, d) => sum + (d.driverPayoutCHF ?? 0), 0);
  return { pending: Math.round(pending * 100) / 100, deliveries };
}

/**
 * Mark a delivery paid after a confirmed external payment.
 *
 * Called from the Payrexx webhook. Idempotent: Payrexx re-fires on every status
 * change, so a second confirmation for an already-authorised delivery is a
 * no-op rather than a duplicate side effect.
 */
export async function markDeliveryPaid(
  deliveryId: string,
  opts: { provider: 'payrexx'; transactionId?: string },
): Promise<void> {
  const delivery = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { paymentStatus: true, budgetCHF: true },
  });
  if (!delivery) return;
  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') return;

  const { driverPayoutCHF } = computeSplit(Number(delivery.budgetCHF));
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: {
      paymentStatus: 'authorised',
      driverPayoutCHF,
      ...(opts.transactionId ? { payrexxTransactionId: opts.transactionId } : {}),
    },
  });
  console.log(`[payment] ${deliveryId} authorised via ${opts.provider}`);
  void deliveryService.announceToRecipient(deliveryId);
}

/** Record a failed or abandoned external payment. */
export async function markDeliveryPaymentFailed(deliveryId: string, reason: string): Promise<void> {
  const delivery = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { paymentStatus: true },
  });
  // Never downgrade a payment that already succeeded.
  if (!delivery || delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') return;

  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { paymentStatus: 'failed' },
  });
  console.log(`[payment] ${deliveryId} payment failed: ${reason}`);
}
