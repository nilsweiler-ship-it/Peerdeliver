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
  /** How the estimate was reached, so the sender can judge whether to trust it. */
  basis: 'weight' | 'dimensions' | 'keyword' | 'default';
}

/**
 * Keyword rules, largest first.
 *
 * DE / FR / IT / EN, because that is what Swiss listings are actually written
 * in. The original rules were English-only, so "Waschmaschine", "Kühlschrank",
 * "Fernseher" and "Fahrrad" matched nothing and everything fell through to the
 * M / 3 kg default — which on ricardo.ch and tutti.ch is very nearly every item.
 *
 * Diacritics are stripped before matching, so "Kühlschrank" and "Kuehlschrank"
 * both hit, as do French terms typed without accents.
 */
const CATEGORY_RULES: {
  match: RegExp;
  size: PackageSize;
  weightKg: number;
  category: string;
}[] = [
  {
    // Furniture and white goods
    match: /sofa|couch|canape|divano|schrank|wardrobe|armoire|armadio|kuhlschrank|fridge|frigo|gefrierschrank|freezer|congelateur|waschmaschine|washing\s?machine|lave-linge|lavatrice|tumbler|trockner|dryer|geschirrspuler|dishwasher|lave-vaisselle|lavastoviglie|matratze|mattress|matelas|materasso|\bbett\b|\bbed\b|\blit\b|letto|kommode|dresser|commode|schreibtisch|\bdesk\b|bureau|scrivania|regal|bookshelf|etagere|scaffale|sessel|armchair|fauteuil|poltrona|esstisch|dining table|\btisch\b|\btable\b|tavolo|buffet|vitrine|sideboard|\bherd\b|backofen|\boven\b|\bfour\b|forno/i,
    size: 'L',
    weightKg: 35,
    category: 'Möbel / Grossgerät',
  },
  {
    // Bulky but liftable by one person
    match: /\bvelo\b|fahrrad|bicycle|\bbike\b|e-?bike|\bvtt\b|bicicletta|trottinett|scooter|roller|kinderwagen|stroller|poussette|passeggino|snowboard|\bskis?\b|surfboard|gitarre|guitar|guitare|chitarra|verstarker|amplifier|monitor|bildschirm|ecran|\btv\b|fernseher|television|televisore|drucker|printer|imprimante|stampante|koffer|suitcase|valise|valigia|kindersitz|car seat|seggiolino|drohne|drone|teppich|carpet|tapis|tappeto|spiegel|mirror|miroir|specchio|staubsauger|vacuum/i,
    size: 'L',
    weightKg: 15,
    category: 'Sperriges Objekt',
  },
  {
    // Medium
    match: /mikrowelle|microwave|micro-?ondes|toaster|wasserkocher|kettle|bouilloire|lautsprecher|speaker|enceinte|altoparlante|stiefel|boots|bottes|stivali|\bhelm\b|helmet|casque|casco|rucksack|backpack|zaino|handtasche|handbag|\blampe\b|\blamp\b|lampada|konsole|console|playstation|ps5|xbox|nintendo|kaffeemaschine|coffee machine|machine a cafe|mixer|blender|werkzeugkoffer|toolbox|bohrmaschine|drill|perceuse/i,
    size: 'M',
    weightKg: 6,
    category: 'Mittleres Objekt',
  },
  {
    // Small
    match: /handy|phone|iphone|smartphone|telefon|telephone|telefono|\buhr\b|watch|montre|orologio|schmuck|jewel|bijou|gioiell|\bbuch\b|\bbook\b|\blivre\b|libro|kleider|clothes|vetements|vestiti|hemd|shirt|chemise|camicia|kleid|dress|robe|vestito|jacke|jacket|veste|giacca|ladegerat|charger|chargeur|kabel|cable|cavo|kopfhorer|headphone|ecouteurs|cuffie|airpods|earbud|kamera|camera|fotocamera|objektiv|\blens\b|obiettivo|tablet|ipad|dokumente|documents|documenti|schlussel|\bkeys?\b|chiavi|portemonnaie|wallet|brille|sunglasses|lunettes|occhiali/i,
    size: 'S',
    weightKg: 1.5,
    category: 'Kleines Objekt',
  },
];

/** Strip diacritics and ß so accented and unaccented spellings both match. */
function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/**
 * Pull an explicit weight from the listing — "15 kg", "1,5kg", "800 g".
 * Listings state this often, and when they do it beats anything we can infer.
 */
function parseWeightKg(text: string): number | null {
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s?kg\b/i);
  if (kg) {
    const v = parseFloat(kg[1].replace(',', '.'));
    if (v > 0 && v < 500) return v;
  }
  const g = text.match(/(\d{3,4})\s?g\b/i);
  if (g) {
    const v = parseFloat(g[1]) / 1000;
    if (v > 0 && v < 500) return v;
  }
  return null;
}

/**
 * Pull dimensions — "180 x 90 x 60 cm", "120x80cm", "200 × 100 mm".
 * Returns the longest edge in cm: whether something fits in a car is decided
 * by its longest edge far more than by its volume.
 */
function parseLongestEdgeCm(text: string): number | null {
  const m = text.match(
    /(\d{1,3}(?:[.,]\d+)?)\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)(?:\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?))?\s*(cm|mm|m)\b/i,
  );
  if (!m) return null;
  const unit = m[4].toLowerCase();
  const factor = unit === 'mm' ? 0.1 : unit === 'm' ? 100 : 1;
  const edges = [m[1], m[2], m[3]]
    .filter(Boolean)
    .map((v) => parseFloat(String(v).replace(',', '.')) * factor);
  const longest = Math.max(...edges);
  return Number.isFinite(longest) && longest > 0 ? longest : null;
}

function sizeFromWeight(kg: number): PackageSize {
  if (kg >= 15) return 'L';
  if (kg >= 3) return 'M';
  return 'S';
}

function sizeFromLongestEdge(cm: number): PackageSize {
  if (cm >= 100) return 'L';
  if (cm >= 40) return 'M';
  return 'S';
}

/**
 * Estimate package size + weight from a listing title / description.
 *
 * Where several signals disagree, the LARGEST wins. Under-estimating means a
 * driver arrives with a car that cannot take the item — a wasted trip for them
 * and a failed delivery for the sender. Over-estimating only means the sender
 * pays slightly more, and they can correct it before confirming.
 */
export function estimateSize(text: string): SizeEstimate {
  const raw = text || '';
  const t = normalise(raw);

  const keyword = CATEGORY_RULES.find((r) => r.match.test(t)) ?? null;
  const weightKg = parseWeightKg(raw);
  const edgeCm = parseLongestEdgeCm(raw);

  const candidates: { size: PackageSize; basis: SizeEstimate['basis'] }[] = [];
  if (weightKg != null) candidates.push({ size: sizeFromWeight(weightKg), basis: 'weight' });
  if (edgeCm != null) candidates.push({ size: sizeFromLongestEdge(edgeCm), basis: 'dimensions' });
  if (keyword) candidates.push({ size: keyword.size, basis: 'keyword' });

  if (!candidates.length) {
    return { size: 'M', weightKg: 3, category: 'Allgemeines Objekt', basis: 'default' };
  }

  const best = candidates.reduce((a, b) => (SIZE_ORDER[b.size] > SIZE_ORDER[a.size] ? b : a));

  return {
    size: best.size,
    // A stated weight always beats a category average.
    weightKg:
      weightKg ?? keyword?.weightKg ?? (best.size === 'L' ? 15 : best.size === 'M' ? 6 : 1.5),
    category: keyword?.category ?? 'Allgemeines Objekt',
    basis: best.basis,
  };
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
