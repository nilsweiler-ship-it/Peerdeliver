import { prisma } from '../config';
import { hashPassword, comparePassword } from '../utils';
import { generateTokenPair, verifyRefreshToken } from './token';
import { AppError } from '../middleware';
import type { RegisterInput, LoginInput } from '@peerdeliver/shared';

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone,
      language: input.language ?? 'en',
      licensePlate: input.licensePlate,
      carModel: input.carModel,
      maxLoadKg: input.maxLoadKg,
      vehicleSize: input.vehicleSize,
    },
  });

  const tokens = generateTokenPair({ userId: user.id, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return { user: safeUser, tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const tokens = generateTokenPair({ userId: user.id, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return { user: safeUser, tokens };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });

  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError(401, 'Invalid refresh token');
  }

  const tokens = generateTokenPair({ userId: user.id, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return tokens;
}

export async function logout(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}
