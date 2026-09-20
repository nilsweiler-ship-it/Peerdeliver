/**
 * What actually happened to the money on one delivery.
 *
 *   cd packages/server
 *   npx tsx scripts/payment-trace.ts                 # the 10 most recent
 *   npx tsx scripts/payment-trace.ts <deliveryId>    # one, in full
 *
 * Written for PAYMENT_TEST_PROTOCOL.md. Every step of that protocol ends with
 * "check the state", and checking it in the app tells you what the app
 * believes rather than what is true — which is precisely the gap that let a
 * delivery read "captured" while the transfer id was null.
 *
 * So this reads the row, and where a Stripe id exists it says so plainly. It
 * does not call Stripe: keeping it read-only against one system means it can
 * be run against production without a second thought.
 *
 * Read-only. Changes nothing.
 */
import 'dotenv/config';
import { prisma } from '../src/config';
import { splitBudget } from '@peerdeliver/shared';

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const chf = (n: number | null | undefined) => (n == null ? '—' : `CHF ${Number(n).toFixed(2)}`);

function dbHost(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    return u.hostname + (u.port ? `:${u.port}` : '');
  } catch {
    return 'unset';
  }
}

/**
 * The expected relationship between delivery status and payment status. A
 * combination outside this table is not necessarily a bug, but it is always
 * worth a look — and during a test protocol it is the thing you are looking
 * for.
 */
function assess(status: string, paymentStatus: string, transferId: string | null): { level: 'ok' | 'warn' | 'bad'; note: string } {
  if (status === 'delivered' && paymentStatus === 'captured' && !transferId) {
    return { level: 'bad', note: 'captured with NO transfer id — the driver has not been paid' };
  }
  if (status === 'delivered' && paymentStatus === 'authorised') {
    return { level: 'warn', note: 'delivered but not captured — the payout failed or never ran' };
  }
  if (status === 'delivered' && paymentStatus === 'captured') {
    return { level: 'ok', note: 'delivered and paid out' };
  }
  if (status !== 'delivered' && paymentStatus === 'captured') {
    return { level: 'bad', note: `paid out at status "${status}" — money left before a confirmed handover` };
  }
  if (paymentStatus === 'authorised') {
    return { level: 'ok', note: 'sender has paid; funds held until the code is confirmed' };
  }
  if (paymentStatus === 'unpaid') {
    return { level: 'warn', note: 'no payment yet — the sheet was cancelled, or the webhook never arrived' };
  }
  if (paymentStatus === 'failed') return { level: 'warn', note: 'payment failed or was abandoned' };
  if (paymentStatus === 'refunded') return { level: 'ok', note: 'refunded to the sender' };
  if (paymentStatus === 'voided') return { level: 'ok', note: 'cancelled before payment' };
  return { level: 'ok', note: '' };
}

async function main() {
  const id = process.argv[2];
  console.log(bold('\nPayment trace') + dim(`  ·  ${dbHost()}`));
  console.log(dim('─'.repeat(78)));

  const rows = await prisma.deliveryRequest.findMany({
    where: id ? { id } : {},
    orderBy: { createdAt: 'desc' },
    take: id ? 1 : 10,
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      budgetCHF: true,
      platformFeeCHF: true,
      driverPayoutCHF: true,
      refundedCHF: true,
      refundedAt: true,
      stripePaymentIntentId: true,
      stripeTransferId: true,
      twintRef: true,
      payrexxTransactionId: true,
      deliveryCode: true,
      co2SavedKg: true,
      createdAt: true,
      updatedAt: true,
      packageDescription: true,
      sender: { select: { email: true, firstName: true } },
      driver: { select: { email: true, firstName: true, stripeAccountId: true, stripePayoutsEnabled: true } },
    },
  });

  if (!rows.length) {
    console.log(id ? r(`  No delivery with id ${id}`) : dim('  No deliveries yet.'));
    return;
  }

  for (const d of rows) {
    const { level, note } = assess(d.status, d.paymentStatus, d.stripeTransferId);
    const mark = level === 'ok' ? g('✓') : level === 'warn' ? y('!') : r('✗');
    const expected = splitBudget(d.budgetCHF);

    console.log(
      `\n${mark} ${bold(d.packageDescription?.slice(0, 40) || '(no description)')}  ${dim(d.id)}`,
    );
    console.log(`  status ${bold(d.status)}  ·  payment ${bold(d.paymentStatus)}  ${dim(note)}`);
    console.log(
      `  budget ${chf(d.budgetCHF)}  ·  fee ${chf(d.platformFeeCHF)}  ·  driver ${chf(d.driverPayoutCHF)}` +
        (d.platformFeeCHF == null
          ? dim(`   (not split yet; would be ${chf(expected.platformFeeCHF)} / ${chf(expected.driverPayoutCHF)})`)
          : Math.abs((d.platformFeeCHF ?? 0) + (d.driverPayoutCHF ?? 0) - d.budgetCHF) > 0.005
            ? r('   ✗ fee + payout does not equal the budget')
            : ''),
    );
    if (d.refundedCHF != null) {
      const full = Math.abs(d.refundedCHF - d.budgetCHF) < 0.005;
      console.log(
        `  refunded ${chf(d.refundedCHF)}${full ? '' : y(' (partial)')}  ${dim(d.refundedAt?.toISOString().slice(0, 16) ?? '')}`,
      );
    }
    console.log(
      `  ${dim('intent')} ${d.stripePaymentIntentId ?? dim('—')}  ${dim('transfer')} ${
        d.stripeTransferId ?? (d.paymentStatus === 'captured' ? r('none') : dim('—'))
      }`,
    );
    if (d.twintRef || d.payrexxTransactionId) {
      console.log(`  ${dim('twintRef')} ${d.twintRef ?? '—'}  ${dim('payrexx')} ${d.payrexxTransactionId ?? '—'}`);
    }
    console.log(
      `  ${dim('sender')} ${d.sender?.email ?? '—'}  ${dim('driver')} ${d.driver?.email ?? dim('unassigned')}`,
    );
    if (d.driver) {
      const ready = d.driver.stripePayoutsEnabled;
      console.log(
        `  ${dim('driver payouts')} ${ready ? g('enabled') : r('NOT enabled')}  ${dim(d.driver.stripeAccountId ?? 'no connected account')}`,
      );
    }
    if (id) {
      // Only when a single delivery was asked for: the code is what releases
      // the money, so it is not something to print across a listing.
      console.log(`  ${dim('delivery code')} ${d.deliveryCode ?? '—'}  ${dim('co2')} ${d.co2SavedKg ?? '—'} kg`);
      console.log(`  ${dim('created')} ${d.createdAt.toISOString()}  ${dim('updated')} ${d.updatedAt.toISOString()}`);
    }
  }

  console.log(dim('\n' + '─'.repeat(78)));
  console.log(dim('  A payment status is what this server recorded. Confirm the money itself'));
  console.log(dim('  in the Stripe dashboard — the two disagreeing is the whole point of looking.\n'));
}

main()
  .catch((e) => {
    console.error(r(`\n  ${e.message}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
