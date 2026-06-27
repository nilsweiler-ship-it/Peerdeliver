import { Request, Response, NextFunction } from 'express';
import { prisma, env } from '../config';
import { success, error } from '../utils';
import { AppError } from '../middleware';

// Swiss number plates: 2-letter canton code + 1–6 digits (e.g. "ZH 123456").
const SWISS_CANTONS = new Set([
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
]);
const PLATE_RE = /^([A-Za-z]{2})[\s.-]?(\d{1,6})$/;

function safe(u: any) {
  const { passwordHash, refreshToken, ...rest } = u;
  return rest;
}

/**
 * Verify a single trust signal. These are SIMULATED checks for the MVP:
 *  - phone: would send an SMS OTP; here we accept a well-formed number.
 *  - id:    would run a KYC/ID check (e.g. Onfido/Sum&Substance); here instant.
 *  - plate: validates the Swiss plate format. Real authentication against the
 *           cantonal vehicle registry needs a licensed data provider (e.g. ASA
 *           / a KYC vendor) — wired here as a format + canton check.
 */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { type, value } = req.body as { type?: string; value?: string };
    const data: Record<string, unknown> = {};

    if (type === 'phone') {
      const v = (value ?? '').trim();
      if (v.replace(/\D/g, '').length < 7) throw new AppError(400, 'Enter a valid phone number');
      data.phone = v;
      data.phoneVerified = true;
    } else if (type === 'plate') {
      const m = (value ?? '').trim().toUpperCase().match(PLATE_RE);
      if (!m || !SWISS_CANTONS.has(m[1])) {
        throw new AppError(400, 'Enter a valid Swiss plate, e.g. ZH 123456');
      }
      data.licensePlate = `${m[1]} ${m[2]}`;
      data.plateVerified = true;
    } else if (type === 'id') {
      data.idVerified = true;
    } else {
      throw new AppError(400, 'Unknown verification type');
    }

    let user = await prisma.user.update({ where: { id: userId }, data });
    // Promote overall status to verified once identity + phone are confirmed.
    if (user.idVerified && user.phoneVerified && user.verificationStatus !== 'verified') {
      user = await prisma.user.update({ where: { id: userId }, data: { verificationStatus: 'verified' } });
    }
    success(res, safe(user));
  } catch (err) {
    next(err);
  }
}

/** Dev-only shortcut to fully verify the current user (for testing). */
export async function devVerifyAll(req: Request, res: Response, next: NextFunction) {
  try {
    if (env.NODE_ENV !== 'development') {
      error(res, 'Not found', 404);
      return;
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { phoneVerified: true, idVerified: true, plateVerified: true, verificationStatus: 'verified' },
    });
    success(res, safe(user));
  } catch (err) {
    next(err);
  }
}
