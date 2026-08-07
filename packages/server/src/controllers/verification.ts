import { Request, Response, NextFunction } from 'express';
import { prisma, env } from '../config';
import { success, error } from '../utils';
import { AppError } from '../middleware';
import { smsService } from '../services';

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
 * Map an SMS failure to something a person can act on.
 *
 * Several of these are account-configuration faults, not user errors — a trial
 * account, a country switched off in Geo Permissions, a wrong Service SID. They
 * used to collapse into "please try again", which is the one piece of advice
 * that cannot possibly work. The Twilio code is appended so a tester can report
 * the exact cause without needing access to the server logs.
 */
function smsMessage(reason?: string, twilioCode?: number): string {
  const base = (() => {
    switch (reason) {
      case 'invalid_number':
        return 'Diese Nummer sieht nicht gültig aus. Bitte prüfe sie.';
      case 'rate_limited':
        return 'Zu viele Versuche. Bitte warte einen Moment.';
      case 'expired':
        return 'Der Code ist abgelaufen. Fordere einen neuen an.';
      case 'incorrect':
        return 'Der Code stimmt nicht.';
      case 'landline':
        return 'An diese Nummer kann keine SMS zugestellt werden (Festnetz).';
      case 'unverified_trial':
        return 'Diese Nummer ist im Twilio-Testkonto nicht freigegeben. Bitte unter „Verified Caller IDs" hinzufügen.';
      case 'geo_blocked':
        return 'SMS in dieses Land sind im Twilio-Konto nicht freigeschaltet (Geo Permissions).';
      case 'blocked':
        return 'Der Mobilfunkanbieter hat die SMS abgelehnt. Bitte andere Nummer versuchen.';
      case 'bad_credentials':
        return 'SMS-Dienst nicht korrekt konfiguriert (Zugangsdaten).';
      case 'no_service':
        return 'SMS-Dienst nicht korrekt konfiguriert (Verify-Service nicht gefunden).';
      default:
        return 'SMS-Versand hat gerade nicht geklappt. Bitte versuch es nochmal.';
    }
  })();
  return twilioCode ? `${base} (Twilio ${twilioCode})` : base;
}

/**
 * Step 1 of phone verification: send a one-time code by SMS.
 *
 * The number is normalised to E.164 here rather than trusting the client, so a
 * user typing "079 123 45 67" works and we never bill for an SMS to a
 * malformed destination.
 */
export async function startPhoneVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, language } = req.body as { phone?: string; language?: string };
    const e164 = smsService.normaliseSwissPhone(phone ?? '');
    if (!e164) throw new AppError(400, 'Bitte gib eine gültige Telefonnummer ein');

    const result = await smsService.sendCode(e164, language ?? 'de');
    if (!result.ok) throw new AppError(400, smsMessage(result.reason, result.twilioCode));

    // Echo the normalised number so the client sends back exactly what Twilio
    // has on file — a mismatch here is the usual cause of "code not found".
    success(res, { phone: e164, simulated: result.simulated === true });
  } catch (err) {
    next(err);
  }
}

/** Step 2: check the code and mark the phone verified. */
export async function checkPhoneVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { phone, code } = req.body as { phone?: string; code?: string };
    const e164 = smsService.normaliseSwissPhone(phone ?? '');
    if (!e164) throw new AppError(400, 'Bitte gib eine gültige Telefonnummer ein');
    if (!/^\d{4,10}$/.test(code ?? '')) throw new AppError(400, 'Bitte gib den Code aus der SMS ein');

    const result = await smsService.checkCode(e164, code!);
    if (!result.ok) throw new AppError(400, smsMessage(result.reason, result.twilioCode));

    let user = await prisma.user.update({
      where: { id: userId },
      data: { phone: e164, phoneVerified: true },
    });
    if (user.idVerified && user.phoneVerified && user.verificationStatus !== 'verified') {
      user = await prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'verified' },
      });
    }
    success(res, safe(user));
  } catch (err) {
    next(err);
  }
}

/**
 * Verify a single trust signal.
 *
 *  - phone: real SMS one-time code via Twilio Verify — use the two-step
 *           startPhoneVerification / checkPhoneVerification endpoints instead.
 *           Kept here only so older app builds don't break, and it now refuses
 *           to self-certify when SMS is actually configured.
 *  - id:    STILL SIMULATED — a real KYC check (Stripe Identity) is pending the
 *           Stripe account approval.
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
      // Once real SMS is configured, a client must not be able to mark its own
      // phone verified without ever receiving a code.
      if (smsService.isConfigured()) {
        throw new AppError(400, 'Bitte bestätige deine Nummer per SMS-Code');
      }
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
