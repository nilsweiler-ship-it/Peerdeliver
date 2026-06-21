import { prisma, env } from '../config';
import { AppError } from '../middleware';

/**
 * Simulated TWINT payments.
 *
 * TWINT is Switzerland's dominant P2P payment app. A production integration would
 * go through an acquirer (Datatrans / Wallee) or Stripe's TWINT method; here we
 * model the *flow* without moving real money: the sender "confirms in TWINT", we
 * hold the amount (authorised), credit the driver on delivery (captured), and
 * reverse on cancellation (refunded/voided). The platform fee is a pure split.
 */

export function computeSplit(budgetCHF: number): { platformFeeCHF: number; driverPayoutCHF: number } {
  const feePct = env.PLATFORM_FEE_PERCENT / 100;
  const platformFeeCHF = Math.round(budgetCHF * feePct * 100) / 100;
  const driverPayoutCHF = Math.round((budgetCHF - platformFeeCHF) * 100) / 100;
  return { platformFeeCHF, driverPayoutCHF };
}

function makeTwintRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `TW-${stamp}-${rand}`;
}

// ---------------- Payment lifecycle ----------------

/**
 * Sender confirms the TWINT payment. Holds (authorises) the budget against the
 * delivery. Idempotent — paying an already-paid delivery is a no-op.
 */
export async function payWithTwint(deliveryId: string, senderId: string, phone?: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.senderId !== senderId) throw new AppError(403, 'Not authorized');
  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') {
    return; // already paid
  }
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: {
      twintRef: delivery.twintRef ?? makeTwintRef(),
      twintPhone: phone ?? delivery.twintPhone ?? null,
      paymentStatus: 'authorised',
    },
  });
}

/**
 * On delivery, split the budget and credit the driver's balance (captured).
 * No-op for deliveries the sender never paid for.
 */
export async function captureAndPayoutOnDelivered(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.paymentStatus === 'captured') return;
  if (delivery.paymentStatus !== 'authorised') {
    // Sender never completed the TWINT payment — nothing to pay out.
    return;
  }
  if (!delivery.driverId) throw new AppError(400, 'No driver on delivery');

  const { platformFeeCHF, driverPayoutCHF } = computeSplit(delivery.budgetCHF);
  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { platformFeeCHF, driverPayoutCHF, paymentStatus: 'captured' },
  });
}

/**
 * On cancellation: refund if the sender already paid (authorised/captured),
 * otherwise just void the unpaid hold.
 */
export async function voidOnCancel(deliveryId: string) {
  const delivery = await prisma.deliveryRequest.findUnique({ where: { id: deliveryId } });
  if (!delivery) return;
  if (delivery.paymentStatus === 'voided' || delivery.paymentStatus === 'refunded') return;

  if (delivery.paymentStatus === 'authorised' || delivery.paymentStatus === 'captured') {
    await prisma.deliveryRequest.update({
      where: { id: deliveryId },
      data: {
        paymentStatus: 'refunded',
        refundedCHF: delivery.budgetCHF,
        refundedAt: new Date(),
      },
    });
    return;
  }

  await prisma.deliveryRequest.update({
    where: { id: deliveryId },
    data: { paymentStatus: 'voided' },
  });
}

// ---------------- Earnings ----------------

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
