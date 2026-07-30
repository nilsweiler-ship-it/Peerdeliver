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
  // `role` arrives as a plain string from the request body. Validate it against
  // the Prisma enum rather than casting, so a bad value is a clean 400 instead
  // of a Prisma runtime error.
  const { role, ...rest } = data;
  let roleValue: UserRole | undefined;
  if (role !== undefined) {
    if (!Object.values(UserRole).includes(role as UserRole)) {
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
