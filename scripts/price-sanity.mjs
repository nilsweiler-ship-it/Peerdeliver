/**
 * Price sanity check.
 *
 *   npm run price:check
 *
 * The pricing model used to be three numbers chosen because the output looked
 * plausible, and it quietly priced a couch table above what Swiss Post charges
 * to carry the same item. Nothing caught that, because nothing compared our
 * price to anything. This does.
 *
 * It prints every size × distance combination against the cheapest real
 * alternative, and fails on the conditions that would make the business not
 * work — not on aesthetics.
 *
 * Requires a built shared package: npm run shared:build
 */
import {
  estimatePriceCHF,
  priceComparison,
} from '../packages/shared/dist/constants/pricing.js';

const DISTANCES = [5, 10, 21, 40, 60, 100];
const SIZES = ['S', 'M', 'L', 'XL'];

// Mirrors computeSplit on the server.
const FEE_PCT = 0.09;
const FEE_MIN = 1.5;
const split = (p) => {
  const fee = Math.min(Math.max(p * FEE_PCT, FEE_MIN), p);
  return { fee, driver: p - fee };
};

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const failures = [];
const notes = [];

console.log('\nPricing vs. the real alternatives');
console.log(dim('Post Sperrgut CHF 31 (max 30 kg / 200 cm) · PostPac CHF 9 · Möbeltaxi CHF 90 + 1.50/km'));
console.log('');
console.log('size   km   Shlep     alt   verdict (no supply)   verdict (supply)  driver');
console.log('─'.repeat(78));

for (const size of SIZES) {
  for (const km of DISTANCES) {
    const price = estimatePriceCHF(km, size);
    // Both worlds: an empty corridor, and one where a driver is going today.
    // The difference between them is the entire speed claim, so both are shown.
    const cold = priceComparison(price, km, size, false);
    const warm = priceComparison(price, km, size, true);
    const cmp = cold;
    const { fee, driver } = split(price);
    const alt = cmp.cheapestAlternativeCHF;

    const paint = (v) =>
      v === 'no_advantage' ? r(v) : v === 'only_option' ? g(v) : g(v);

    console.log(
      `${size.padEnd(5)} ${String(km).padStart(4)}   ${String(price).padStart(5)}   ${String(alt ?? '—').padStart(5)}   ${paint(cold.verdict).padEnd(30)} ${paint(warm.verdict).padEnd(28)} ${driver.toFixed(2).padStart(6)}`,
    );

    // The speed claim must depend on supply, never on the product alone.
    // If these two ever agree for every input, the coverage gate has been
    // bypassed and we are promising same-day to empty corridors.
    if (cold.fasterThanAlternative) {
      failures.push(
        `${size} @ ${km} km claims to be faster with no driver coverage — the same-day gate is not working.`,
      );
    }
    // Conversely, with supply we must beat a next-day post on speed.
    const rivalsAllNextDay = warm.alternatives
      .filter((a) => typeof a.priceCHF === 'number')
      .every((a) => a.speed === 'next_day');
    if (rivalsAllNextDay && !warm.fasterThanAlternative) {
      failures.push(
        `${size} @ ${km} km: every alternative is next-day, yet we do not register as faster even with coverage.`,
      );
    }

    // ── Conditions that would break the business ───────────────────────────
    // XL is the whole thesis: no postal option exists, so if we cannot beat a
    // Möbeltaxi here there is no segment where we win on price.
    if (size === 'XL' && !cmp.beatsAlternative) {
      failures.push(`XL @ ${km} km does not beat the Möbeltaxi — that is the one class that must.`);
    }

    // What the driver must be compensated for is the DETOUR, not the trip —
    // they were driving this corridor anyway, which is the entire premise. So
    // the yardstick is a plausible detour (~25% of the corridor at CHF 0.70/km,
    // roughly Swiss vehicle cost) plus CHF 8 for the loading and handover time.
    // Judging against full per-km vehicle cost would condemn every price here
    // and would be measuring a different business.
    const detourFloor = 8 + 0.7 * 0.25 * km;
    if (driver < detourFloor) {
      failures.push(
        `${size} @ ${km} km pays the driver CHF ${driver.toFixed(2)}, under the CHF ${detourFloor.toFixed(2)} a detour of this length plausibly costs them.`,
      );
    }

    // Not a failure, but worth seeing: the fee floor means small jobs barely
    // contribute, so the mix matters more than the volume.
    if (fee <= FEE_MIN + 0.001 && price >= 15) {
      notes.push(`${size} @ ${km} km: platform earns only the CHF ${FEE_MIN} floor.`);
    }
  }
  // A class that loses to the alternative nearly everywhere is a strategic
  // problem, not a rounding error — it means we are selling something the
  // incumbent already does better and cheaper.
  const wins = DISTANCES.filter((km) =>
    priceComparison(estimatePriceCHF(km, size), km, size).beatsAlternative,
  ).length;
  if (wins <= 1) {
    notes.push(
      `${size} beats the alternative at only ${wins}/${DISTANCES.length} distances — Post is simply better at this class.`,
    );
  }

  console.log('─'.repeat(78));
}

if (notes.length) {
  console.log('\nNotes');
  for (const n of notes) console.log('  · ' + n);
}

if (failures.length) {
  console.log(r('\nFailures'));
  for (const f of failures) console.log(r('  ✗ ' + f));
  process.exitCode = 1;
} else {
  console.log(
    g(
      '\n✓ Every class beats its alternative where it claims to, no trip underpays a driver,\n  and no same-day claim is made without driver coverage.',
    ),
  );
}

console.log(
  dim(
    '\nTwo verdict columns: what a buyer is told when no driver is on this corridor,\nand when one is. A red no_advantage is not a bug — Post charges a flat CHF 31\nregardless of distance, so it wins long hauls, and the quote says so rather than\nhiding it. The columns must differ: that gap is the same-day claim being earned.\n',
  ),
);
