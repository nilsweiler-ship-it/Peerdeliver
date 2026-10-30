import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../config';
import { AppError } from '../middleware';

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return safeUser;
}

/** Roles a user may switch between in their own profile. Never 'admin'. */
const SELF_SERVICE_ROLES: UserRole[] = [UserRole.sender, UserRole.driver, UserRole.both, UserRole.recipient];

export async function updateProfile(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    language?: string;
    role?: string;
    shareLocation?: boolean;
    licensePlate?: string | null;
    carModel?: string | null;
    maxLoadKg?: number | null;
    vehicleSize?: 'S' | 'M' | 'L' | 'XL' | null;
  },
) {
  // `role` arrives as a plain string from the request body. Only the roles a
  // person may pick for themselves are accepted. This used to check against
  // the whole Prisma enum — which includes 'admin' — so anyone could PATCH
  // themselves to admin, refresh their token, and pass every requireRole gate.
  const { role, ...rest } = data;
  let roleValue: UserRole | undefined;
  if (role !== undefined) {
    if (!SELF_SERVICE_ROLES.includes(role as UserRole)) {
      throw new AppError(400, `Invalid role: ${role}`);
    }
    roleValue = role as UserRole;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: roleValue === undefined ? rest : { ...rest, role: roleValue },
  });
  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return safeUser;
}

/** Statuses in which a delivery still needs this person. */
const IN_PROGRESS = ['pending', 'requested', 'offered', 'matched', 'accepted', 'picked_up', 'in_transit', 'disputed'] as const;

/**
 * Delete an account — or, where the law and other people need the record to
 * survive, strip everything that identifies the person.
 *
 * A plain delete failed with a 500 (foreign key) for anyone who had ever sent
 * or driven a delivery, so the right to erasure could not be exercised at
 * all. But those deliveries cannot simply vanish either: the other party's
 * history, ratings and messages point at them, and payment records must be
 * kept for bookkeeping. So: refuse while a delivery is still in progress (it
 * needs this person), delete outright when nothing refers to the account,
 * and otherwise anonymise it in place.
 */
export async function deleteAccount(userId: string) {
  const busy = await prisma.deliveryRequest.count({
    where: {
      OR: [{ senderId: userId }, { driverId: userId }],
      status: { in: [...IN_PROGRESS] },
    },
  });
  if (busy > 0) {
    throw new AppError(
      409,
      'Du hast noch laufende Lieferungen. Schliesse sie ab oder storniere sie, bevor du dein Konto löschst.',
    );
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return { deleted: true, anonymised: false };
  } catch {
    // Referenced by past deliveries, ratings or messages: anonymise instead.
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.shlep.ch`,
      // Not a hash of anything: nobody can log in to this account again.
      passwordHash: `!deleted-${randomUUID()}`,
      refreshToken: null,
      firstName: 'Gelöschtes',
      lastName: 'Konto',
      phone: null,
      avatarUrl: null,
      bio: null,
      licensePlate: null,
      carModel: null,
      expoPushToken: null,
      shareLocation: false,
    },
  });
  return { deleted: false, anonymised: true };
}
