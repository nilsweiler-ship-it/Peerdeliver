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

/**
 * How soon the item arrives. Ordered, so speeds can be compared.
 *
 * `scheduled` means you book a slot — a Möbeltaxi can often come today, but
 * only if someone is free, so it is not reliably faster than next-day.
 */
export type DeliverySpeed = 'same_day' | 'next_day' | 'scheduled';

export const SPEED_RANK: Record<DeliverySpeed, number> = {
  same_day: 3,
  scheduled: 2,
  next_day: 1,
};

export interface AlternativeQuote {
  key: 'post_parcel' | 'post_bulky' | 'moebeltaxi';
  label: string;
  /** null when this option cannot carry the item at all. */
  priceCHF: number | null;
  speed: DeliverySpeed;
  /** Does someone collect from the sender, or must they take it somewhere? */
  doorToDoor: boolean;
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
      speed: 'next_day',
      doorToDoor: false,
      note:
        size === 'S'
          ? 'Next day, up to 2 kg. You pack it and hand it in.'
          : 'Too large for a standard parcel.',
    },
    {
      key: 'post_bulky',
      label: 'Post Sperrgut Priority',
      priceCHF: overPostLimit ? null : MARKET_REFERENCE.postBulkyCHF,
      speed: 'next_day',
      doorToDoor: false,
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
      speed: 'scheduled',
      doorToDoor: true,
      note: 'Booked slot, two people, carried to the door.',
    },
  ];
}

/**
 * Where we stand against the alternatives, on both dimensions people care
 * about.
 *
 * - `only_option`  nothing else will carry this item at all
 * - `cheaper_and_faster`
 * - `cheaper`      costs less, but no speed advantage we can promise
 * - `faster`       costs more, arrives sooner
 * - `no_advantage` slower and dearer — say so
 *
 * `no_advantage` is a real and expected outcome, not a bug: Post carries a
 * small parcel for a flat CHF 9 next day, and no base fare that also pays a
 * driver can undercut that.
 */
export type ComparisonVerdict =
  | 'only_option'
  | 'cheaper_and_faster'
  | 'cheaper'
  | 'faster'
  | 'no_advantage';

export interface ComparisonResult {
  alternatives: AlternativeQuote[];
  cheapestAlternativeCHF: number | null;
  savingCHF: number | null;
  beatsAlternative: boolean;
  /** True only when we can actually deliver today — see `sameDayRealistic`. */
  fasterThanAlternative: boolean;
  /** Neither party has to take the item anywhere. */
  doorToDoorAdvantage: boolean;
  verdict: ComparisonVerdict;
}

/**
 * Compare on price, speed and effort.
 *
 * `sameDayRealistic` is the honest gate on the speed claim, and it defaults to
 * false. Same-day is not a property of the product — it is a property of
 * whether a driver happens to be going that way today. Deriving it from live
 * coverage means an empty corridor produces "cheaper" rather than "cheaper and
 * faster", which is the difference between a comparison and an advert. A
 * marketplace embedding this on its own checkout page is lending us its
 * credibility; a same-day promise we cannot keep spends it.
 */
export function priceComparison(
  ourPriceCHF: number,
  distanceKm: number,
  size: PackageSize,
  sameDayRealistic = false,
): ComparisonResult {
  const alternatives = marketAlternatives(distanceKm, size);
  const carriable = alternatives.filter(
    (a): a is AlternativeQuote & { priceCHF: number } => typeof a.priceCHF === 'number',
  );

  const cheapest = carriable.length ? Math.min(...carriable.map((a) => a.priceCHF)) : null;
  const saving = cheapest == null ? null : Math.round(cheapest - ourPriceCHF);
  const beats = saving != null && saving > 0;

  // Our speed, stated conservatively: same-day only when supply supports it.
  const ourSpeed: DeliverySpeed = sameDayRealistic ? 'same_day' : 'next_day';

  // Compare against the fastest thing that could actually take the item —
  // beating a slow option while a fast one exists is not an advantage.
  const bestRivalSpeed = carriable.reduce(
    (best, a) => Math.max(best, SPEED_RANK[a.speed]),
    0,
  );
  const faster = carriable.length > 0 && SPEED_RANK[ourSpeed] > bestRivalSpeed;

  // Everything else either wants the item brought to a counter, or sends two
  // people and charges for them.
  const doorToDoorAdvantage = carriable.every((a) => !a.doorToDoor);

  const verdict: ComparisonVerdict =
    carriable.length === 0
      ? 'only_option'
      : beats && faster
        ? 'cheaper_and_faster'
        : beats
          ? 'cheaper'
          : faster
            ? 'faster'
            : 'no_advantage';

  return {
    alternatives,
    cheapestAlternativeCHF: cheapest,
    savingCHF: saving,
    beatsAlternative: beats,
    fasterThanAlternative: faster,
    doorToDoorAdvantage,
    verdict,
  };
}
