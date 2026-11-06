import { prisma } from '../config';
import { AppError } from '../middleware';

/**
 * Who may carry a stranger's parcel.
 *
 * The website promises drivers whose identity has been checked. Until now that
 * promise was collected but never enforced: claiming, accepting and picking up
 * a delivery only asked whether we could pay the driver, never who they were.
 *
 * The rule is the one the verification flow already computes:
 * verificationStatus = 'verified' means the phone number AND the ID document
 * have been confirmed.
 *
 * ALLOW_PHONE_ONLY_DRIVERS=true relaxes this to a confirmed phone number. It
 * exists for one situation — a closed pilot with people you know, while the
 * Stripe Identity application is still in review — and it is logged at boot.
 * It must not be on for a public launch, and while it is on the product must
 * not describe drivers as ID-checked.
 */
export function phoneOnlyDriversAllowed(): boolean {
  return process.env.ALLOW_PHONE_ONLY_DRIVERS === 'true';
}

export const VERIFICATION_REQUIRED = 'VERIFICATION_REQUIRED';

export async function assertDriverVerified(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true, phoneVerified: true },
  });
  if (!user) throw new AppError(404, 'User not found');
  if (user.verificationStatus === 'verified') return;
  if (phoneOnlyDriversAllowed() && user.phoneVerified) return;
  throw new AppError(
    403,
    phoneOnlyDriversAllowed()
      ? 'Bitte bestätige zuerst deine Telefonnummer, bevor du Lieferungen übernimmst.'
      : 'Bitte bestätige zuerst deine Identität und deine Telefonnummer, bevor du Lieferungen übernimmst.',
    VERIFICATION_REQUIRED,
  );
}
