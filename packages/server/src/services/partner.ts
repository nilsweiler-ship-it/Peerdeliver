import { prisma, env } from '../config';
import { computeSplit } from './payment';
import { estimatePriceCHF, priceComparison } from '@peerdeliver/shared';
import type { PackageSize, ComparisonResult } from '@peerdeliver/shared';

/**
 * Partner integration service.
 *
 * Powers the embeddable checkout widget: a marketplace asks "can Shlep deliver
 * this, and what does it cost?" for a given origin/destination, and gets back a
 * price estimate plus a live coverage signal derived from actual driver supply.
 *
 * Deliberately read-only and unauthenticated beyond an API key — creating the
 * delivery still happens in Shlep (deep link), so a partner can integrate
 * front-end only.
 */

export interface QuoteInput {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  /**
   * Rough size class. 'xl' means beyond Swiss Post's Sperrgut ceiling
   * (30 kg / 200 cm) — a sofa, a fridge, a wardrobe.
   */
  size?: 'small' | 'medium' | 'large' | 'xl';
  /** Declared item value in CHF — used for the insurance note, not the price. */
  declaredValueCHF?: number;
}

export interface QuoteResult {
  available: boolean;
  currency: 'CHF';
  /** Recommended price shown to the buyer. */
  priceCHF: number;
  /** Suggested range the sender can choose within. */
  priceRangeCHF: { min: number; max: number };
  distanceKm: number;
  /** How much of the price reaches the driver, given the 9% / min CHF 1.50 fee. */
  driverPayoutCHF: number;
  platformFeeCHF: number;
  /** Live supply signal on this corridor. */
  coverage: {
    level: 'high' | 'medium' | 'low' | 'none';
    matchingRoutes: number;
    estimatedMatchHours: number | null;
  };
  /**
   * What Shlep is, stated in the API rather than left to a partner's
   * imagination.
   *
   * Shlep introduces a sender to a driver and verifies the handover; the
   * transport agreement is between those two people, exactly as the terms have
   * always said. This field replaced `insuredUpToCHF: 1000`, which was a
   * hardcoded number with no policy, no underwriter and no claims process
   * behind it — a promise the terms simultaneously disclaimed.
   */
  liability: {
    model: 'intermediary';
    /** No transport cover exists today. Null, not zero: zero implies a policy. */
    transportCoverCHF: null;
    /** What genuinely protects the sender, and does so today. */
    paymentHeldUntilDelivery: boolean;
    note: string;
  };
  co2SavedKg: number;
  /**
   * What the sender would otherwise pay, including when an alternative is
   * cheaper than us. A price with no reference invites the buyer to assume the
   * worst; a comparison that hides a cheaper option would not survive the first
   * person who checks post.ch.
   */
  comparison: ComparisonResult;
  /** Ready-to-use deep link that opens Shlep with this delivery prefilled. */
  deepLink: string;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Partner-facing size words → internal size classes. */
const SIZE_WORD_TO_CLASS: Record<NonNullable<QuoteInput['size']>, PackageSize> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xl: 'XL',
};

export function sizeClassFor(size: QuoteInput['size'] = 'small'): PackageSize {
  return SIZE_WORD_TO_CLASS[size] ?? 'S';
}

/**
 * Suggested price.
 *
 * Now delegates to the shared model, whose constants are anchored to published
 * Post and Möbeltaxi prices. The old version multiplied an invented base by an
 * invented size factor and produced CHF 37 for a couch table — more than Post
 * charges to carry the same item.
 */
export function estimatePrice(distanceKm: number, size: QuoteInput['size'] = 'small'): number {
  return estimatePriceCHF(distanceKm, sizeClassFor(size));
}

/** How many published, active driver routes plausibly serve this corridor. */
async function countMatchingRoutes(input: QuoteInput, radiusKm = 25): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count
     FROM driver_routes dr
     WHERE dr."isActive" = true
       AND ST_DWithin(
         dr."originPoint"::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         $5
       )
       AND ST_DWithin(
         dr."destinationPoint"::geography,
         ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
         $5
       )`,
    input.fromLat,
    input.fromLng,
    input.toLat,
    input.toLng,
    radiusKm * 1000,
  );
  return Number(rows[0]?.count ?? 0);
}

function coverageFor(matchingRoutes: number) {
  if (matchingRoutes >= 8) return { level: 'high' as const, estimatedMatchHours: 2 };
  if (matchingRoutes >= 3) return { level: 'medium' as const, estimatedMatchHours: 6 };
  if (matchingRoutes >= 1) return { level: 'low' as const, estimatedMatchHours: 24 };
  return { level: 'none' as const, estimatedMatchHours: null };
}

export function buildDeepLink(input: QuoteInput, priceCHF: number): string {
  const base = env.PARTNER_DEEPLINK_BASE.replace(/\/$/, '');
  const p = new URLSearchParams({
    fromLat: input.fromLat.toFixed(5),
    fromLng: input.fromLng.toFixed(5),
    toLat: input.toLat.toFixed(5),
    toLng: input.toLng.toFixed(5),
    price: String(priceCHF),
    size: input.size ?? 'small',
    src: 'partner',
  });
  if (input.declaredValueCHF) p.set('value', String(input.declaredValueCHF));
  return `${base}/new?${p.toString()}`;
}

export async function quote(input: QuoteInput): Promise<QuoteResult> {
  const distanceKm = Math.round(haversineKm(input.fromLat, input.fromLng, input.toLat, input.toLng) * 10) / 10;
  const priceCHF = estimatePrice(distanceKm, input.size);
  const { platformFeeCHF, driverPayoutCHF } = computeSplit(priceCHF);

  const matchingRoutes = await countMatchingRoutes(input).catch(() => 0);
  const cov = coverageFor(matchingRoutes);

  return {
    available: distanceKm <= env.PARTNER_MAX_DISTANCE_KM,
    currency: 'CHF',
    priceCHF,
    priceRangeCHF: {
      min: Math.max(8, Math.round(priceCHF * 0.8)),
      max: Math.round(priceCHF * 1.3),
    },
    distanceKm,
    driverPayoutCHF,
    platformFeeCHF,
    coverage: { level: cov.level, matchingRoutes, estimatedMatchHours: cov.estimatedMatchHours },
    liability: {
      model: 'intermediary',
      transportCoverCHF: null,
      paymentHeldUntilDelivery: true,
      note: 'Shlep introduces senders and drivers and is not a party to the transport agreement. No transport insurance is offered. The payment is held and released only after a code-confirmed handover.',
    },
    // ~0.18 kg CO2 per km avoided vs. a dedicated van trip; conservative estimate.
    co2SavedKg: Math.round(distanceKm * 0.18 * 10) / 10,
    // Same-day is only claimed when supply on this corridor plausibly supports
    // it. `coverageFor` maps high/medium to a 2–6 hour expected match; low is
    // 24 hours and none has no drivers at all, neither of which is same-day in
    // any sense a buyer would accept.
    comparison: priceComparison(
      priceCHF,
      distanceKm,
      sizeClassFor(input.size),
      cov.level === 'high' || cov.level === 'medium',
    ),
    deepLink: buildDeepLink(input, priceCHF),
  };
}

/** Partner API keys come from env as `name:key` pairs, comma separated. */
export function resolvePartner(apiKey: string): string | null {
  const entries = env.PARTNER_API_KEYS.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const idx = entry.indexOf(':');
    if (idx === -1) continue;
    const name = entry.slice(0, idx).trim();
    const key = entry.slice(idx + 1).trim();
    if (key && key === apiKey) return name;
  }
  return null;
}
