import type { PackageSize } from '../types/delivery';

export const SIZE_ORDER: Record<PackageSize, number> = { S: 1, M: 2, L: 3 };
export const ALL_SIZES: PackageSize[] = ['S', 'M', 'L'];

/** Sizes a vehicle of capacity `max` can carry (everything up to and including max). */
export function sizesUpTo(max: PackageSize): PackageSize[] {
  return ALL_SIZES.filter((s) => SIZE_ORDER[s] <= SIZE_ORDER[max]);
}

/** Route/vehicle sizes able to carry an item of at least `min`. */
export function sizesFrom(min: PackageSize): PackageSize[] {
  return ALL_SIZES.filter((s) => SIZE_ORDER[s] >= SIZE_ORDER[min]);
}

// ── Auto-size estimation from a marketplace listing ──────────────────────────

export interface SizeEstimate {
  size: PackageSize;
  weightKg: number;
  category: string;
}

// Keyword → size/weight heuristics, checked largest-first. A real integration
// would use the marketplace's category + an AI/vision pass; this covers the
// common second-hand cases well enough to pre-fill the request.
const CATEGORY_RULES: { match: RegExp; size: PackageSize; weightKg: number; category: string }[] = [
  { match: /sofa|couch|wardrobe|fridge|freezer|washing\s?machine|dishwasher|mattress|bed\b|dresser|desk|bookshelf|armchair|dining table|cupboard/i, size: 'L', weightKg: 25, category: 'Furniture / large appliance' },
  { match: /bike|bicycle|e-?bike|scooter|stroller|snowboard|\bskis?\b|surfboard|guitar|amplifier|monitor|\btv\b|television|printer|suitcase|car seat|drone/i, size: 'L', weightKg: 12, category: 'Bulky item' },
  { match: /microwave|vacuum|toaster|kettle|speaker|boots|helmet|backpack|handbag|lamp|console|playstation|ps5|xbox|nintendo|coffee machine|blender|toolbox/i, size: 'M', weightKg: 5, category: 'Medium item' },
  { match: /phone|iphone|smartphone|watch|jewel|\bbook\b|clothes|shirt|dress|jacket|charger|cable|headphone|earbud|airpods|camera|lens|tablet|ipad|documents|keys|wallet|sunglasses/i, size: 'S', weightKg: 1, category: 'Small item' },
];

/** Estimate package size + weight from a listing title / description. */
export function estimateSize(text: string): SizeEstimate {
  const t = text || '';
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(t)) return { size: rule.size, weightKg: rule.weightKg, category: rule.category };
  }
  return { size: 'M', weightKg: 3, category: 'General item' };
}

/** Does a vehicle (size + max load) have room for an item (size + weight)? */
export function fitsCapacity(
  itemSize: PackageSize,
  itemWeightKg: number | null | undefined,
  vehicleSize: PackageSize | null | undefined,
  maxLoadKg: number | null | undefined,
): boolean {
  if (vehicleSize && SIZE_ORDER[itemSize] > SIZE_ORDER[vehicleSize]) return false;
  if (maxLoadKg != null && itemWeightKg != null && itemWeightKg > maxLoadKg) return false;
  return true;
}
