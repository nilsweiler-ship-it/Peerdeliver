import { env } from '../config/env';

/**
 * SMS one-time codes via Twilio Verify.
 *
 * Verify (rather than plain SMS) means Twilio owns code generation, expiry,
 * retry limits and per-number rate limiting. We never store or compare a code
 * ourselves, so there is no window where a valid code sits in our database.
 *
 * Uses fetch against the REST API — no SDK, matching the approach in email.ts.
 *
 * Unconfigured behaviour: logs the request and accepts any 6-digit code. That
 * keeps local development and CI working without credentials, and
 * `isConfigured()` lets callers refuse to run that way in production.
 */

const BASE = 'https://verify.twilio.com/v2/Services';

export function isConfigured(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID,
  );
}

function authHeader(): string {
  const raw = `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/**
 * Normalise a Swiss mobile number to E.164, which Twilio requires.
 *
 * Accepts the forms people actually type: 079 123 45 67, +41 79 123 45 67,
 * 0041791234567, 79 123 45 67. Anything already in +<country> form is passed
 * through so non-Swiss numbers still work.
 *
 * Returns null if it cannot produce something plausible — better to reject at
 * the edge than to send an SMS into the void and bill for it.
 */
export function normaliseSwissPhone(input: string): string | null {
  let s = (input ?? '').replace(/[^\d+]/g, '');
  if (!s) return null;

  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (s.startsWith('+')) {
    // Already international. Sanity-check length: E.164 allows max 15 digits.
    const digits = s.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    return s;
  }
  // National form: 0791234567 → +41791234567
  if (s.startsWith('0')) s = s.slice(1);
  // Swiss mobile and landline national numbers are 9 digits after the 0.
  if (s.length !== 9) return null;
  return `+41${s}`;
}

interface VerifyResult {
  ok: boolean;
  /** Machine-readable reason when ok is false, for mapping to a user message. */
  reason?: 'invalid_number' | 'rate_limited' | 'expired' | 'incorrect' | 'error';
  simulated?: boolean;
}

/** Send a one-time code by SMS. */
export async function sendCode(phoneE164: string, locale = 'de'): Promise<VerifyResult> {
  if (!isConfigured()) {
    console.warn(`[sms:skipped] would send code to ${phoneE164} (Twilio not configured)`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`${BASE}/${env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phoneE164,
        Channel: 'sms',
        // Twilio localises its default template; de/fr/it/en all supported.
        Locale: ['de', 'fr', 'it', 'en'].includes(locale) ? locale : 'de',
      }),
    });

    if (res.ok) return { ok: true };

    const body = await res.text().catch(() => '');
    console.error(`[sms:send-failed] ${res.status} ${body.slice(0, 300)}`);
    // 60200 = invalid parameter (bad number), 60203 = max send attempts.
    if (body.includes('60200')) return { ok: false, reason: 'invalid_number' };
    if (body.includes('60203') || res.status === 429) return { ok: false, reason: 'rate_limited' };
    return { ok: false, reason: 'error' };
  } catch (err) {
    console.error('[sms:send-error]', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'error' };
  }
}

/** Check a code the user entered. */
export async function checkCode(phoneE164: string, code: string): Promise<VerifyResult> {
  if (!isConfigured()) {
    const ok = /^\d{6}$/.test(code);
    console.warn(`[sms:skipped] accepting code ${code} for ${phoneE164} (Twilio not configured)`);
    return { ok, reason: ok ? undefined : 'incorrect', simulated: true };
  }

  try {
    const res = await fetch(`${BASE}/${env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phoneE164, Code: code }),
    });

    const body = await res.text().catch(() => '');

    // A 404 means the verification expired or was already consumed — Twilio
    // deletes it rather than returning "expired", which is easy to misread as
    // a wrong code.
    if (res.status === 404) return { ok: false, reason: 'expired' };
    if (!res.ok) {
      console.error(`[sms:check-failed] ${res.status} ${body.slice(0, 300)}`);
      if (res.status === 429) return { ok: false, reason: 'rate_limited' };
      return { ok: false, reason: 'error' };
    }

    const data = JSON.parse(body) as { status?: string; valid?: boolean };
    if (data.valid === true || data.status === 'approved') return { ok: true };
    return { ok: false, reason: 'incorrect' };
  } catch (err) {
    console.error('[sms:check-error]', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'error' };
  }
}
