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

type FailureReason =
  | 'invalid_number'
  | 'rate_limited'
  | 'expired'
  | 'incorrect'
  | 'unverified_trial'
  | 'geo_blocked'
  | 'landline'
  | 'blocked'
  | 'bad_credentials'
  | 'no_service'
  | 'error';

interface VerifyResult {
  ok: boolean;
  /** Machine-readable reason when ok is false, for mapping to a user message. */
  reason?: FailureReason;
  /** Twilio's numeric error code, so a failure can be diagnosed without log access. */
  twilioCode?: number;
  simulated?: boolean;
}

/**
 * Map Twilio's numeric error codes to something we can act on.
 *
 * These are the failures that actually occur in practice. The first four are
 * account-configuration problems rather than anything the user did wrong, and
 * telling them apart matters: "try again" is useless advice when the account is
 * on trial or the destination country is switched off.
 *
 * https://www.twilio.com/docs/api/errors
 */
function reasonForCode(code: number | undefined, status: number): FailureReason {
  switch (code) {
    case 21608: // Trial account: destination not in Verified Caller IDs.
      return 'unverified_trial';
    case 21408: // Geo Permissions: sending to this country is not enabled.
    case 21215:
      return 'geo_blocked';
    case 21211: // Invalid 'To'.
    case 21614:
    case 60200: // Invalid parameter.
      return 'invalid_number';
    case 60203: // Max send attempts reached.
    case 20429:
      return 'rate_limited';
    case 60205: // SMS not supported by this landline.
      return 'landline';
    case 60410: // Verification delivery blocked by carrier/Twilio.
    case 30003:
    case 30005:
    case 30006:
      return 'blocked';
    case 20003: // Authenticate — wrong Account SID or Auth Token.
    case 20005:
      return 'bad_credentials';
    case 20404: // Resource not found — usually a wrong Verify Service SID.
      return 'no_service';
    default:
      return status === 429 ? 'rate_limited' : 'error';
  }
}

/** Pull { code, message } out of a Twilio error body, tolerating non-JSON. */
function parseTwilioError(body: string): { code?: number; message?: string } {
  try {
    const j = JSON.parse(body) as { code?: number; message?: string; more_info?: string };
    return { code: j.code, message: j.message };
  } catch {
    return {};
  }
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
    const { code, message } = parseTwilioError(body);
    const reason = reasonForCode(code, res.status);
    console.error(
      `[sms:send-failed] http=${res.status} twilio=${code ?? '?'} reason=${reason} to=${phoneE164} msg=${message ?? body.slice(0, 200)}`,
    );
    return { ok: false, reason, twilioCode: code };
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
      const { code, message } = parseTwilioError(body);
      const reason = reasonForCode(code, res.status);
      console.error(
        `[sms:check-failed] http=${res.status} twilio=${code ?? '?'} reason=${reason} to=${phoneE164} msg=${message ?? body.slice(0, 200)}`,
      );
      return { ok: false, reason, twilioCode: code };
    }

    const data = JSON.parse(body) as { status?: string; valid?: boolean };
    if (data.valid === true || data.status === 'approved') return { ok: true };
    return { ok: false, reason: 'incorrect' };
  } catch (err) {
    console.error('[sms:check-error]', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Send a plain SMS (not a verification code).
 *
 * Used to reach a recipient who has no Shlep account — the person receiving a
 * parcel is often not a user, and a phone number is frequently the only contact
 * detail the sender has for someone met on a marketplace.
 *
 * This uses the Messages API rather than Verify, so it needs a sending number
 * (TWILIO_FROM_NUMBER) or an approved alphanumeric sender ID. Without one it
 * logs and returns false rather than throwing — a missed notification must
 * never fail a delivery.
 */
export async function sendSms(phoneE164: string, body: string): Promise<boolean> {
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_SENDER_ID;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !from) {
    console.warn(`[sms:skipped] would text ${phoneE164}: ${body.slice(0, 60)}`);
    return false;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phoneE164, From: from, Body: body }),
      },
    );
    if (res.ok) return true;
    console.error(`[sms:send-failed] ${res.status} ${(await res.text()).slice(0, 200)}`);
    return false;
  } catch (err) {
    console.error('[sms:error]', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Tell an unregistered recipient a parcel is on its way, with the code. */
export function notifyRecipientPickedUp(phone: string, route: string, deliveryCode: string): void {
  const e164 = normaliseSwissPhone(phone);
  if (!e164) return;
  void sendSms(
    e164,
    `Shlep: Dein Paket ist unterwegs (${route}). Zustellcode: ${deliveryCode} — bitte der fahrenden Person bei der Übergabe nennen.`,
  );
}
