import { env } from '../config/env';

/**
 * Payrexx — Swiss PSP, used here for real TWINT payments.
 *
 * SCOPE, and why it stops where it does:
 *
 * This module takes money FROM the sender. It does not pay drivers.
 *
 * Payrexx's standard merchant API has no way to split a payment to a third
 * party: `applicationFee` exists on the Gateway object but there is no
 * recipient parameter. Splitting is part of their separate Platform product,
 * where every payee needs their own KYC-approved merchant account.
 *
 * Critically, Payrexx's prohibited-business list names "any form of licensed or
 * unlicensed pooling of funds owed to third parties". Collecting into our
 * account and forwarding the driver's share ourselves is exactly that — and it
 * is the same activity that makes us a financial intermediary under the Swiss
 * AMLA. So the driver payout leg deliberately stays with a provider that is the
 * regulated party (Stripe Connect, or Payrexx Platform under contract).
 *
 * Auth uses the X-API-KEY header. Payrexx also offers an HMAC ApiSignature
 * scheme with awkward RFC1738-vs-RFC3986 encoding rules; the header avoids all
 * of that and is their documented recommendation.
 */

const API_BASE = 'https://api.payrexx.com/v1.16';

/** Payrexx transaction statuses we care about. Note their inconsistent naming. */
export type PayrexxStatus =
  | 'waiting'
  | 'confirmed'
  | 'cancelled'
  | 'declined'
  | 'authorized'
  | 'reserved'
  | 'refunded'
  | 'partially-refunded'
  | 'refund_pending'
  | 'chargeback'
  | 'disputed'
  | 'expired'
  | 'error'
  | 'initiated';

export function isConfigured(): boolean {
  return Boolean(env.PAYREXX_INSTANCE && env.PAYREXX_API_SECRET);
}

function url(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${sep}instance=${encodeURIComponent(env.PAYREXX_INSTANCE!)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    headers: {
      'X-API-KEY': env.PAYREXX_API_SECRET!,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    // 405/403 is how their WAF reports rate limiting — not 429.
    throw new Error(`Payrexx ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Payrexx returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export interface Gateway {
  id: number;
  hash: string;
  status: PayrexxStatus;
  referenceId: string;
  link: string;
  amount: number;
  currency: string;
}

interface GatewayResponse {
  status: string;
  data: Gateway[];
}

/**
 * Create a hosted TWINT payment page for a delivery.
 *
 * `reserve` holds the funds instead of charging immediately, which matches the
 * delivery lifecycle: the sender commits at booking, the money moves once the
 * parcel is actually handed over. Without it we would be holding a charge for
 * a service that may never happen.
 *
 * Amounts are in Rappen. TWINT itself enforces min CHF 0.50 / max CHF 20'000.
 */
export async function createTwintGateway(opts: {
  deliveryId: string;
  amountCHF: number;
  purpose: string;
  successUrl: string;
  failedUrl: string;
  cancelUrl: string;
  language?: string;
  reserve?: boolean;
}): Promise<Gateway> {
  const amountRappen = Math.round(opts.amountCHF * 100);
  if (amountRappen < 50) throw new Error('TWINT minimum is CHF 0.50');
  if (amountRappen > 2_000_000) throw new Error('TWINT maximum is CHF 20000');

  const body: Record<string, unknown> = {
    amount: amountRappen,
    currency: 'CHF',
    purpose: opts.purpose,
    // Our delivery id comes back on the webhook — this is the join key.
    referenceId: opts.deliveryId,
    successRedirectUrl: opts.successUrl,
    failedRedirectUrl: opts.failedUrl,
    cancelRedirectUrl: opts.cancelUrl,
    pm: ['twint'],
    language: opts.language ?? 'de',
  };
  if (opts.reserve) body.reservation = true;

  const res = await request<GatewayResponse>('/Gateway/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const gateway = res.data?.[0];
  if (!gateway?.link) throw new Error('Payrexx returned no gateway link');
  return gateway;
}

/**
 * Re-read a gateway from the API.
 *
 * Always call this before treating a payment as complete. Payrexx is explicit
 * that neither the redirect URL nor the in-app postMessage is authoritative,
 * and a webhook body can be forged if signature verification is misconfigured.
 */
export async function getGateway(id: number): Promise<Gateway | null> {
  try {
    const res = await request<GatewayResponse>(`/Gateway/${id}/`);
    return res.data?.[0] ?? null;
  } catch (err) {
    console.error('[payrexx:get-gateway]', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Capture a reserved payment once the parcel is delivered. */
export async function captureTransaction(transactionId: number): Promise<boolean> {
  try {
    await request(`/Transaction/${transactionId}/capture/`, { method: 'POST' });
    return true;
  } catch (err) {
    console.error('[payrexx:capture]', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Release a reservation when a delivery is cancelled before handover. */
export async function cancelTransaction(transactionId: number): Promise<boolean> {
  try {
    await request(`/Transaction/${transactionId}/`, { method: 'DELETE' });
    return true;
  } catch (err) {
    console.error('[payrexx:cancel]', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Verify a webhook came from Payrexx.
 *
 * Their docs state the header is an HMAC-SHA256 of the raw body but do not
 * specify hex or base64, so both are accepted and compared in constant time.
 * This is belt-and-braces only: callers must still re-fetch the gateway from
 * the API before acting, which is what actually makes forgery useless.
 */
export function verifyWebhookSignature(rawBody: string, header: string | undefined): boolean {
  if (!env.PAYREXX_WEBHOOK_SECRET) return false;
  if (!header) return false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto') as typeof import('crypto');
  // Two separate HMACs: a Hmac object cannot be read twice.
  const hex = crypto
    .createHmac('sha256', env.PAYREXX_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const b64 = crypto
    .createHmac('sha256', env.PAYREXX_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');

  const given = header.trim();
  const eq = (a: string, b: string) => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  };
  return eq(given, hex) || eq(given, b64);
}
