#!/usr/bin/env node
/**
 * Run every static check and leave a report behind.
 *
 *   npm run verify:all
 *
 * Writes .reports/verify.json as well as printing, so the result can be read
 * by whoever is helping rather than copied out of a terminal by hand. Keeps
 * going after a failure: knowing that three things are broken in one run is
 * worth more than finding them one at a time.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const STEPS = [
  ['shared package builds', 'npm', ['run', 'shared:build', '--silent']],
  ['types — server, scripts, app', 'npm', ['run', 'typecheck', '--silent']],
  ['preflight — config, i18n, payout gate', 'node', ['scripts/preflight.mjs']],
  ['contrast — 21 colour pairs', 'node', ['scripts/contrast-check.mjs']],
  ['pricing — no unearned claims', 'node', ['scripts/price-sanity.mjs']],
  ['payment arithmetic', 'node', ['scripts/payment-battle.mjs']],
];

console.log(bold('\nStatic checks'));
console.log(dim('─'.repeat(70)));

const results = [];
for (const [name, cmd, args] of STEPS) {
  const out = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  const ok = out.status === 0;
  results.push({
    step: name,
    result: ok ? 'pass' : 'fail',
    // Enough of the tail to diagnose, not so much that the file is unreadable.
    output: ok ? null : `${out.stdout ?? ''}${out.stderr ?? ''}`.trim().slice(-2500),
  });
  console.log(`  ${ok ? g('✓') : r('✗')} ${name}`);
  if (!ok) console.log(dim(`${`${out.stdout ?? ''}${out.stderr ?? ''}`.trim().split('\n').slice(-6).map((l) => '      ' + l).join('\n')}`));
}

const failed = results.filter((x) => x.result === 'fail');
try {
  mkdirSync(join(ROOT, '.reports'), { recursive: true });
  writeFileSync(
    join(ROOT, '.reports/verify.json'),
    JSON.stringify({ ranAt: new Date().toISOString(), failed: failed.length, results }, null, 2),
  );
} catch {
  /* a report is a convenience */
}

console.log(dim('─'.repeat(70)));
console.log(dim('  Full report: .reports/verify.json'));
if (failed.length) {
  console.log(r(`\n  ${failed.length} of ${results.length} failed.\n`));
  process.exit(1);
}
console.log(g(`\n  All ${results.length} passed.\n`));
