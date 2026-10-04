#!/usr/bin/env node
/**
 * Every text/background pair in the palette, measured.
 *
 *   npm run contrast
 *
 * The brand green was #14532D for months: a contrast of 7.94 against paper,
 * so dark it read as near-black and the app looked grey rather than green.
 * Nobody noticed, because nobody measured — it was chosen by eye, approved by
 * eye, and shipped.
 *
 * This is the check that would have caught it, and that catches the opposite
 * mistake too: a green light enough to look right but too light to read.
 *
 * WCAG AA is 4.5:1 for normal text, 3:1 for large text and UI boundaries.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'packages/app/src/theme/colors.ts'), 'utf8');

const hexOf = (name) => src.match(new RegExp(`\\b${name}:\\s*'(#[0-9A-Fa-f]{6})'`))?.[1];
const toRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = toRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// [foreground, background, minimum, why]
const PAIRS = [
  ['text', 'background', 4.5, 'body text on paper'],
  ['text', 'surface', 4.5, 'body text on a card'],
  ['textSecondary', 'background', 4.5, 'secondary text on paper'],
  ['textSecondary', 'surface', 4.5, 'secondary text on a card'],
  ['textLight', 'background', 4.5, 'captions on paper'],
  ['textLight', 'surface', 4.5, 'captions on a card'],
  ['primary', 'background', 4.5, 'forest as text on paper'],
  ['onPrimary', 'primary', 4.5, 'white on a primary button'],
  ['onPrimary', 'primaryDark', 4.5, 'white on the pressed state'],
  ['text', 'accentAmber', 4.5, 'ink on amber — amber NEVER takes white'],
  ['signalText', 'signalSoft', 4.5, 'amber label on an amber badge'],
  ['signalText', 'background', 4.5, 'amber label on paper'],
  ['impactText', 'impactSurface', 4.5, 'eco figure on the eco card'],
  ['impactText', 'background', 4.5, 'eco figure on paper'],
  ['impactOnDark', 'text', 4.5, 'eco text on a dark panel'],
  ['textInverse', 'text', 4.5, 'paper text on ink'],
  ['error', 'background', 4.5, 'error on paper'],
  ['info', 'background', 4.5, 'info on paper'],
  ['destination', 'background', 3, 'destination pin — a mark, not text'],
  ['impact', 'background', 3, 'eco dot — a mark, not text'],
  ['primaryLight', 'background', 3, 'moss fill — a mark, not text'],
];

console.log('\n\x1b[1mPalette contrast\x1b[0m');
console.log(dim('─'.repeat(74)));
let failed = 0;
for (const [fg, bg, min, why] of PAIRS) {
  const a = hexOf(fg), b = hexOf(bg);
  if (!a || !b) { console.log(`${r('?')} ${fg} on ${bg} — token not found`); failed += 1; continue; }
  const v = ratio(a, b);
  const ok = v >= min;
  if (!ok) failed += 1;
  console.log(
    `${ok ? g('✓') : r('✗')} ${v.toFixed(2).padStart(5)}  ${dim(`need ${min}`)}  ${`${fg} on ${bg}`.padEnd(32)} ${dim(why)}`,
  );
}
console.log(dim('─'.repeat(74)));
if (failed) {
  console.log(r(`\n${failed} pair(s) below the threshold. Adjust the token, not the threshold.\n`));
  process.exit(1);
}
console.log(g('\nEvery pair meets its threshold.\n'));
