import type { PackageSize } from '../types/delivery';

/**
 * CO₂ saved by a delivery — measured against what would otherwise have
 * happened, marginally, on both sides.
 *
 *
 * WHAT WAS WRONG BEFORE
 *
 * The old figure was `distance_km × 0.12`. That silently assumed two things,
 * both false for most deliveries:
 *
 *   1. that the alternative was a dedicated car trip of the same distance, and
 *   2. that the Shlep trip itself emitted nothing.
 *
 * For anything Swiss Post would have carried, (1) is wrong: Post runs a
 * consolidated round — roughly 50 miles split across 120 drops — so a parcel's
 * share is on the order of 100–180 g, and the *marginal* cost of one more
 * parcel on a round already passing the door is lower still. And (2) is always
 * wrong: a driver collecting and dropping off makes a detour, which is real
 * fuel.
 *
 * So the old formula credited every small parcel with a saving it had not
 * made, and in many cases the true figure is negative.
 *
 *
 * WHAT IS COMPARED NOW
 *
 *   saved = max(0, counterfactual_transport − our_transport) + packaging_saved
 *
 * Both sides marginal. `our_transport` is the DETOUR the driver makes, not the
 * corridor length — the corridor was being driven anyway, which is the entire
 * premise of the service. Where the driver's published route is known the
 * detour is computed from it; otherwise a conservative fraction is assumed.
 *
 * Clamped at zero: we never claim a negative saving, but we also never invent
 * a positive one. A small parcel typically lands at zero transport saving and
 * keeps only the packaging credit, which is honest and modest.
 *
 *
 * SOURCES (checked September 2026)
 *  - Petrol car ≈ 0.20 kg CO₂e/km
 *  - Van ≈ 0.27 kg CO₂e/km
 *  - Consolidated parcel round ≈ 0.10–0.18 kg per parcel; the marginal figure
 *    is lower, so the low end is used — understating our own saving on purpose
 *  - Corrugated board ≈ 0.7 kg CO₂e per kg of board
 */

export const CO2 = {
  /** Average petrol car, per km. */
  carKgPerKm: 0.2,
  /** Delivery van — what a Möbeltaxi actually drives. */
  vanKgPerKm: 0.27,
  /**
   * One more parcel on a round already passing the address. Deliberately the
   * low end of the published range: a smaller counterfactual means a smaller
   * claimed saving.
   */
  postParcelKg: 0.1,
  /** Bulky goods take more van space, still consolidated. */
  postBulkyKg: 0.5,
  /**
   * Detour assumed when the driver's route is unknown, as a fraction of the
   * corridor. A driver who accepts a delivery near their path still leaves it
   * and returns to it.
   */
  assumedDetourFraction: 0.25,
} as const;

/** Packaging avoided, kg CO₂e, by what the sender wrapped it in. */
const PACKAGING_SAVED_KG: Record<string, Record<PackageSize, number>> = {
  // A courier shipment of this size would have needed a new corrugated box.
  none: { S: 0.11, M: 0.25, L: 0.56, XL: 0.9 },
  // Reusing a box avoids making a new one, but the material was made once.
  reused: { S: 0.05, M: 0.12, L: 0.28, XL: 0.45 },
  // A new box is the courier baseline: no saving, no penalty.
  cardboard: { S: 0, M: 0, L: 0, XL: 0 },
  other: { S: 0, M: 0, L: 0, XL: 0 },
};

/**
 * What the item would have cost in CO₂ without Shlep.
 *
 * S/M/L go by post — consolidated, and remarkably efficient per parcel. XL has
 * no postal option at all, so the realistic alternative is a Möbeltaxi making
 * a dedicated round trip: out and back, hence the factor of two.
 */
export function counterfactualKg(distanceKm: number, size: PackageSize): number {
  if (size === 'XL') return 2 * Math.max(0, distanceKm) * CO2.vanKgPerKm;
  if (size === 'L') return CO2.postBulkyKg;
  return CO2.postParcelKg;
}

export interface Co2Input {
  distanceKm: number;
  size: PackageSize;
  packaging?: string | null;
  /**
   * Extra km the driver actually drove because of this delivery. Compute it
   * from their published route when there is one:
   *   (origin→pickup→dropoff→destination) − (origin→destination)
   * Leave undefined and a conservative fraction of the corridor is assumed.
   */
  detourKm?: number;
}

export interface Co2Result {
  /** kg CO₂e, never negative. */
  savedKg: number;
  transportSavedKg: number;
  packagingSavedKg: number;
  /** The detour used, so the figure can be explained and audited. */
  detourKmUsed: number;
  /**
   * False when the transport comparison came out at or below zero — the post
   * would have done it at least as cleanly. The packaging credit may still
   * apply. Worth surfacing rather than hiding: a claim that survives being
   * checked is worth more than a larger one that does not.
   */
  beatsAlternativeOnTransport: boolean;
}

export function computeCo2Saved(input: Co2Input): Co2Result {
  const distanceKm = Math.max(0, input.distanceKm || 0);
  const detourKm =
    input.detourKm != null && input.detourKm >= 0
      ? input.detourKm
      : distanceKm * CO2.assumedDetourFraction;

  const ours = detourKm * CO2.carKgPerKm;
  const theirs = counterfactualKg(distanceKm, input.size);
  const transportSavedKg = Math.max(0, theirs - ours);

  const packagingSavedKg =
    PACKAGING_SAVED_KG[input.packaging ?? 'cardboard']?.[input.size] ?? 0;

  return {
    savedKg: Math.round((transportSavedKg + packagingSavedKg) * 100) / 100,
    transportSavedKg: Math.round(transportSavedKg * 100) / 100,
    packagingSavedKg: Math.round(packagingSavedKg * 100) / 100,
    detourKmUsed: Math.round(detourKm * 10) / 10,
    beatsAlternativeOnTransport: transportSavedKg > 0,
  };
}

/**
 * Detour created by slotting a delivery into a driver's existing route.
 * Straight-line distances are close enough for an emissions estimate and
 * avoid a routing call.
 */
export function detourKm(
  km: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
  route: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } },
  delivery: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number } },
): number {
  const direct = km(route.origin, route.destination);
  const viaDelivery =
    km(route.origin, delivery.pickup) +
    km(delivery.pickup, delivery.dropoff) +
    km(delivery.dropoff, route.destination);
  return Math.max(0, viaDelivery - direct);
}
