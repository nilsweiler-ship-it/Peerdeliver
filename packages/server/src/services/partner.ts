import { prisma, env } from '../config';
import { computeSplit } from './payment';

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
  /** Rough size class of the item; drives the base price. */
  size?: 'small' | 'medium' | 'large';
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
  insuredUpToCHF: number;
  co2SavedKg: number;
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

/** Size multipliers: a sofa is worth more to carry than a charger cable. */
const SIZE_FACTOR: Record<NonNullable<QuoteInput['size']>, number> = {
  small: 1,
  medium: 1.35,
  large: 1.9,
};

/**
 * Suggested price. Deliberately simple and explainable — senders set the final
 * price in Shlep, this is the anchor a marketplace shows at checkout.
 */
export function estimatePrice(distanceKm: number, size: QuoteInput['size'] = 'small'): number {
  const base = 8;
  const perKm = 0.55;
  const raw = (base + distanceKm * perKm) * SIZE_FACTOR[size];
  // Round to the nearest franc; keep it inside sane bounds.
  return Math.min(Math.max(Math.round(raw), 8), 200);
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
    insuredUpToCHF: 1000,
    // ~0.18 kg CO2 per km avoided vs. a dedicated van trip; conservative estimate.
    co2SavedKg: Math.round(distanceKm * 0.18 * 10) / 10,
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
