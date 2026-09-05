import type { PackageSize } from '../types/delivery';
import { POST_BULKY_LIMIT } from './delivery-status';

/**
 * Pricing, anchored to what the alternatives actually cost.
 *
 * The previous model was three numbers I picked because the output looked
 * plausible (base 8, CHF 0.55/km, ×1.9 for large). It put a couch table at
 * CHF 37 — above Swiss Post's CHF 31 for the same item, in a segment where Post
 * is next-day, insured and nationwide. We were pricing into the incumbent's
 * strength.
 *
 * Every constant below is now derived from a published alternative, and the
 * comment says which. Where no alternative exists — anything past Post's
 * Sperrgut ceiling — the anchor becomes the Möbeltaxi, and the gap is wide
 * enough to pay a driver properly and still undercut it substantially.
 *
 * Sources (checked 7 August 2026):
 *  - Swiss Post Sperrgut Priority: CHF 32.50, less the CHF 1.50 online discount
 *  - Swiss Post PostPac Economy up to 2 kg: CHF 9.00 (2026 price list)
 *  - Möbeltaxi / Kleintransport: advertised from CHF 28–35, realistic single-item
 *    jobs CHF 69–105, typical furniture transports CHF 280–650
 */

/** What each alternative charges. Distance-independent unless noted. */
export const MARKET_REFERENCE = {
  /** PostPac Economy, up to 2 kg. Next day. Sender packs and hands in. */
  postParcelCHF: 9,
  /** Sperrgut Priority incl. online discount. Next day. Max 30 kg / 200 cm. */
  postBulkyCHF: 31,
  /** Möbeltaxi: a call-out fee plus distance. Same day, two people, insured. */
  moebeltaxiBaseCHF: 90,
  moebeltaxiPerKmCHF: 1.5,
} as const;

/**
 * Base fare and per-km rate per size class.
 *
 * S/M sit below the postal alternatives but cannot beat them meaningfully —
 * Post moves a small parcel for CHF 9. For these classes we compete on same-day
 * and door-to-door, not on price, and the rate is set by what makes a detour
 * worth a driver's time rather than by the incumbent.
 *
 * L is set to land under Post's CHF 31 over typical Swiss inter-town distances.
 *
 * XL is where the economics actually work: no postal option exists, so the
 * comparison is a Möbeltaxi, and there is room to pay a driver CHF 60–100 and
 * still be less than half the alternative.
 */
export const SIZE_PRICING: Record<PackageSize, { baseCHF: number; perKmCHF: number }> = {
  S: { baseCHF: 10, perKmCHF: 0.35 },
  M: { baseCHF: 12, perKmCHF: 0.45 },
  L: { baseCHF: 14, perKmCHF: 0.55 },
  XL: { baseCHF: 35, perKmCHF: 1.6 },
};

/**
 * The base fares above are set by a hard constraint, not by taste: after the
 * platform fee, every job must leave the driver more than the detour plausibly
 * costs them — roughly CHF 8 for loading and handover, plus a detour of about a
 * quarter of the corridor at CHF 0.70/km. Lower bases produced quotes that paid
 * a driver CHF 6.50 to collect and hand over a parcel, which nobody sane
 * accepts twice. `npm run price:check` enforces this.
 *
 * A consequence worth stating plainly: at these bases the S class loses to
 * Post's flat CHF 9 parcel almost everywhere. That is not a pricing bug to be
 * tuned away — it is Post being genuinely better at small parcels, and no base
 * fare exists that both pays a driver and undercuts CHF 9.
 */

/** Never quote below this — a shorter trip is still a trip. */
export const MIN_PRICE_CHF = 8;
/** Sanity ceiling; beyond this a dedicated mover is the honest answer. */
export const MAX_PRICE_CHF = 300;

export function estimatePriceCHF(distanceKm: number, size: PackageSize = 'S'): number {
  const { baseCHF, perKmCHF } = SIZE_PRICING[size];
  const raw = baseCHF + Math.max(0, distanceKm) * perKmCHF;
  return Math.min(Math.max(Math.round(raw), MIN_PRICE_CHF), MAX_PRICE_CHF);
}

export interface AlternativeQuote {
  key: 'post_parcel' | 'post_bulky' | 'moebeltaxi';
  label: string;
  /** null when this option cannot carry the item at all. */
  priceCHF: number | null;
  /** Plain-language reason it is or is not an option. */
  note: string;
}

/**
 * What the sender would otherwise pay.
 *
 * Returned to partners and shown at the point of quoting, including the cases
 * where an alternative is cheaper than us. Presenting a price with no reference
 * invites the buyer to assume the worst; presenting one that hides a cheaper
 * option is worse, and would not survive the first person who checks.
 */
export function marketAlternatives(distanceKm: number, size: PackageSize): AlternativeQuote[] {
  const overPostLimit = size === 'XL';

  return [
    {
      key: 'post_parcel',
      label: 'Post PostPac Economy',
      priceCHF: size === 'S' ? MARKET_REFERENCE.postParcelCHF : null,
      note:
        size === 'S'
          ? 'Next day, up to 2 kg. You pack it and hand it in.'
          : 'Too large for a standard parcel.',
    },
    {
      key: 'post_bulky',
      label: 'Post Sperrgut Priority',
      priceCHF: overPostLimit ? null : MARKET_REFERENCE.postBulkyCHF,
      note: overPostLimit
        ? `Over Post's limit of ${POST_BULKY_LIMIT.maxKg} kg / ${POST_BULKY_LIMIT.maxLongestEdgeCm} cm — not accepted at any price.`
        : 'Next day. You pack it and hand it in.',
    },
    {
      key: 'moebeltaxi',
      label: 'Möbeltaxi / Kleintransport',
      priceCHF: Math.round(
        MARKET_REFERENCE.moebeltaxiBaseCHF + distanceKm * MARKET_REFERENCE.moebeltaxiPerKmCHF,
      ),
      note: 'Same day, two people, carried to the door.',
    },
  ];
}

/**
 * The cheapest alternative, and whether we actually beat it.
 *
 * `beatsAlternative: false` is a legitimate and expected answer — over long
 * distances Post's flat Sperrgut price wins, and saying so is the only version
 * of this feature worth shipping.
 */
export function priceComparison(
  ourPriceCHF: number,
  distanceKm: number,
  size: PackageSize,
): {
  alternatives: AlternativeQuote[];
  cheapestAlternativeCHF: number | null;
  savingCHF: number | null;
  beatsAlternative: boolean;
} {
  const alternatives = marketAlternatives(distanceKm, size);
  const prices = alternatives
    .map((a) => a.priceCHF)
    .filter((p): p is number => typeof p === 'number');
  const cheapest = prices.length ? Math.min(...prices) : null;
  const saving = cheapest == null ? null : Math.round(cheapest - ourPriceCHF);
  return {
    alternatives,
    cheapestAlternativeCHF: cheapest,
    savingCHF: saving,
    beatsAlternative: saving != null && saving > 0,
  };
}
