import { prisma } from '../config';
import { hashPassword, comparePassword } from '../utils';
import { generateTokenPair, verifyRefreshToken } from './token';
import { AppError } from '../middleware';
import * as emailService from './email';
import type { RegisterInput, LoginInput } from '@peerdeliver/shared';
import { TERMS_VERSION } from '@peerdeliver/shared';

/**
 * One account per mailbox, whatever the capitalisation.
 *
 * Emails were stored and compared exactly as typed, so Bob@x.ch and bob@x.ch
 * were two accounts. Besides the confusion, that let anyone open a second
 * account under someone else's address — including a recipient's, which a
 * driver can read off the delivery. New addresses are stored lower-case;
 * lookups are case-insensitive so existing mixed-case accounts still log in.
 */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: normaliseEmail(email), mode: 'insensitive' } } });
}

export async function register(input: RegisterInput) {
  const existing = await findByEmail(input.email);
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: normaliseEmail(input.email),
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
      // Proof of consent: when, and to which version of the terms.
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
    },
  });

  const tokens = generateTokenPair({ userId: user.id, role: user.role });
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  // Welcome mail — fire-and-forget, never blocks or fails signup.
  emailService.sendWelcome({
    to: user.email,
    firstName: user.firstName,
    language: user.language,
  });

  const { passwordHash: _, refreshToken: __, ...safeUser } = user;
  return { user: safeUser, tokens };
}

export async function login(input: LoginInput) {
  const user = await findByEmail(input.email);
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
