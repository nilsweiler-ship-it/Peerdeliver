/**
 * Who has signed up, and — more importantly — which side they are on.
 *
 *   cd packages/server
 *   npx tsx scripts/waitlist.ts
 *
 * A two-sided marketplace lives or dies on the balance. Ten senders and no
 * drivers is not ten signups, it is a demand list with nobody to serve it;
 * ten drivers and no senders is the reverse. The same total reads completely
 * differently depending on the split, so the split is what this leads with.
 *
 * Route hints matter almost as much: two people on the same corridor are worth
 * more than ten scattered across the country, because liquidity is local.
 * Read-only — it changes nothing.
 */
import 'dotenv/config';
import { prisma } from '../src/config';

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main() {
  const rows = await prisma.waitlistSignup.findMany({ orderBy: { createdAt: 'asc' } });

  if (!rows.length) {
    console.log('\nNo signups yet.\n');
    return;
  }

  const senders = rows.filter((r) => r.role === 'sender' || r.role === 'both').length;
  const drivers = rows.filter((r) => r.role === 'driver' || r.role === 'both').length;
  const unstated = rows.filter((r) => !r.role).length;

  console.log(`\n${bold(`${rows.length} signups`)}\n`);
  console.log(`  Would send    ${String(senders).padStart(3)}`);
  console.log(`  Would drive   ${String(drivers).padStart(3)}   ${drivers === 0 ? dim('← no supply yet') : ''}`);
  if (unstated) console.log(`  Didn't say    ${String(unstated).padStart(3)}`);

  // Liquidity is local. Two on one corridor beats ten spread thin.
  const hints = rows.map((r) => r.routeHint).filter((h): h is string => !!h?.trim());
  if (hints.length) {
    const byRoute = new Map<string, number>();
    for (const h of hints) {
      const key = h.trim().toLowerCase();
      byRoute.set(key, (byRoute.get(key) ?? 0) + 1);
    }
    console.log(`\n${dim('  Routes mentioned')}`);
    for (const [route, n] of [...byRoute].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n > 1 ? g(`${n}×`) : ' 1×'}  ${route}`);
    }
  }

  const byLang = new Map<string, number>();
  for (const r of rows) byLang.set(r.language, (byLang.get(r.language) ?? 0) + 1);
  console.log(
    `\n${dim('  Language')}  ` + [...byLang].map(([l, n]) => `${l.toUpperCase()} ${n}`).join(' · '),
  );

  console.log(`\n${dim('  Signups')}`);
  for (const r of rows) {
    const when = r.createdAt.toISOString().slice(0, 10);
    console.log(
      `  ${when}  ${(r.role ?? '—').padEnd(7)} ${r.email.padEnd(34)} ${dim(r.source)}${
        r.routeHint ? dim(`  ${r.routeHint}`) : ''
      }`,
    );
  }

  // The point of the list is to talk to the people on it.
  console.log(
    `\n${dim('  These are real people who raised a hand. The next useful thing is not')}`,
  );
  console.log(`${dim('  another feature — it is asking them what they would actually send.')}\n`);
}

main()
  .catch((err) => {
    console.error('Failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
