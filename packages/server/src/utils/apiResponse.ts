import { localize, requestLang } from '../i18n/messages';
import { randomInt } from 'crypto';
import { Response } from 'express';

export function success<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function error(res: Response, message: string, statusCode = 400) {
  // In the language the app asked for (see i18n/messages.ts).
  const lang = requestLang(res.req?.headers['accept-language']);
  return res.status(statusCode).json({ success: false, error: localize(message, lang) });
}

/**
 * A handover code. From the OS's CSPRNG: Math.random() is predictable from
 * enough samples, and these six digits are what stands between a parcel and
 * a payout.
 */
export function generateCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += String(randomInt(0, 10));
  return code;
}
