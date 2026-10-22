import { prisma, env } from '../config';
import { AppError } from '../middleware';
import { getStripe, stripeConfigured } from './stripe';

/**
 * Identity verification, performed by Stripe.
 *
 *
 * WHAT THIS REPLACES
 *
 * `idVerified` used to be set by a client saying so. The endpoint did exactly
 * `data.idVerified = true` — no document, no check, no upload — while the
 * website told senders that every profile was verified. That is the same class
 * of claim as the CO₂ figure and the insurance promise: true-sounding, and
 * backed by nothing.
 *
 *
 * WHY STRIPE RATHER THAN OURSELVES
 *
 * Not convenience. Holding passport scans makes us a processor of biometric
 * and identity data under the Swiss DSG, with the retention, access-control
 * and breach obligations that follow — for a company that is one person. And
 * it sits badly beside our position as an intermediary who never touches the
 * money either.
 *
 * With the hosted flow the document goes from the driver's camera to Stripe.
 * It never reaches this server, never enters the database, and never appears
 * in a backup. What comes back is a boolean and, if we ask for it, a name and
 * date of birth we already had.
 *
 * The flag is set by Stripe's webhook, never by a request from the client.
 * That is the whole point: a client cannot assert its own identity.
 */

export interface StartVerificationResult {
  /** Single-use, expires in 48 hours. Never log or store it. */
  url: string;
}

const RETURN_BASE = (process.env.PAYOUT_RETURN_BASE || 'https://shlep.ch').replace(/\/$/, '');

export async function startIdentityVerification(userId: string): Promise<StartVerificationResult> {
  if (!stripeConfigured()) {
    throw new AppError(503, 'Identity verification is not configured');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, idVerified: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  if (user.idVerified) throw new AppError(400, 'Already verified');

  const stripe = getStripe();
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    // Prefilled so the driver does not retype what we already hold.
    provided_details: { email: user.email },
    // The webhook has nothing but this to tell it whose verification this is.
    // Without it a verified session cannot be attributed to anyone.
    metadata: { userId: user.id },
    return_url: `${RETURN_BASE}/identity-return.html`,
  });

  if (!session.url) {
    throw new AppError(502, 'Stripe did not return a verification URL');
  }
  return { url: session.url };
}

/**
 * Called from the Stripe webhook when a session completes.
 *
 * Idempotent, and deliberately narrow: it sets one flag, and promotes the
 * overall status only when the phone is verified too. A document check does
 * not on its own make someone contactable.
 */
export async function markIdentityVerified(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, idVerified: true, phoneVerified: true, verificationStatus: true },
  });
  if (!user || user.idVerified) return;

  await prisma.user.update({ where: { id: userId }, data: { idVerified: true } });

  if (user.phoneVerified && user.verificationStatus !== 'verified') {
    await prisma.user.update({ where: { id: userId }, data: { verificationStatus: 'verified' } });
  }
  console.log(`[identity] ${userId} verified by Stripe`);
}

/**
 * A check failed — a blurred photo, an expired document, a mismatch.
 *
 * Recorded rather than silently ignored, because the difference between "has
 * not started" and "tried and was rejected" matters to the person and to
 * anyone looking at why they cannot accept deliveries.
 */
export async function markIdentityRejected(userId: string, reason?: string): Promise<void> {
  console.warn(`[identity] ${userId} not verified${reason ? `: ${reason}` : ''}`);
  await prisma.user.updateMany({
    where: { id: userId, idVerified: false },
    data: { verificationStatus: 'rejected' },
  });
}
