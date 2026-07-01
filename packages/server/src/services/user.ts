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
  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });
  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return safeUser;
}

export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}
