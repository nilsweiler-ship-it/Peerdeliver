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
    vehicleSize?: 'S' | 'M' | 'L' | null;
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

export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
