/**
 * Pay the drivers whose payout failed.
 *
 *   npm run payout:retry            # list what is owed, change nothing
 *   npm run payout:retry --run      # actually retry
 *   npm run payout:retry <id> --run # one delivery
 *
 * A delivery that is `delivered` with payment still `authorised` and no
 * transfer id is a driver who carried a parcel, confirmed the handover with a
 * code, and was not paid. Until now there was no way to put that right: the
 * payout runs exactly once, inside verifyDelivery, and nothing retries it.
 *
 * The first cause was Stripe refusing the transfer because the platform's
 * available balance was zero — card funds sit pending for days, so the balance
 * is empty at precisely the moment a delivery completes. That is fixed at the
 * source now (transfers carry `source_transaction`), but the deliveries
 * stranded by it still need paying, and the next cause of a failed transfer
 * will need the same tool.
 *
 * Safe to run repeatedly: captureAndPayoutOnDelivered passes an idempotency
 * key of `delivery-transfer-<id>`, so a retry cannot produce a second payment
 * even if the first one actually succeeded and we failed to record it.
 *
 * Defaults to a dry run. Moving money should take more than a typo.
 */
import 'dotenv/config';
import { prisma } from '../src/config';
import { captureAndPayoutOnDelivered } from '../src/services/payment';

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const chf = (n: number | null | undefined) => `CHF ${Number(n ?? 0).toFixed(2)}`;

async function main() {
  const args = process.argv.slice(2);
  const run = args.includes('--run');
  const only = args.find((a) => !a.startsWith('--'));

  const stranded = await prisma.deliveryRequest.findMany({
    where: {
      ...(only ? { id: only } : {}),
      status: 'delivered',
      paymentStatus: 'authorised',
      stripeTransferId: null,
    },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      packageDescription: true,
      budgetCHF: true,
      driverPayoutCHF: true,
      updatedAt: true,
      driver: { select: { email: true, stripePayoutsEnabled: true } },
    },
  });

  console.log(bold('\nUnpaid completed deliveries'));
  console.log(dim('─'.repeat(74)));

  if (!stranded.length) {
    console.log(g('\n  None. Every completed delivery has been paid out.\n'));
    return;
  }

  let owed = 0;
  for (const d of stranded) {
    owed += d.driverPayoutCHF ?? 0;
    console.log(
      `\n  ${bold(d.packageDescription?.slice(0, 34) || '(no description)')} ${dim(d.id)}\n` +
        dim(
          `    owed ${chf(d.driverPayoutCHF)} of ${chf(d.budgetCHF)}  ·  ${d.driver?.email ?? 'no driver'}` +
            `  ·  delivered ${d.updatedAt.toISOString().slice(0, 16)}`,
        ),
    );
    if (d.driver && !d.driver.stripePayoutsEnabled) {
      console.log(r('    driver payouts are NOT enabled — this will fail again until they onboard'));
    }
  }

  console.log(dim('\n' + '─'.repeat(74)));
  console.log(`  ${stranded.length} delivery(ies), ${bold(chf(owed))} owed to drivers`);

  if (!run) {
    console.log(dim('\n  Dry run. Add --run to actually pay these.\n'));
    return;
  }

  console.log(bold('\nRetrying…'));
  let paid = 0;
  for (const d of stranded) {
    try {
      await captureAndPayoutOnDelivered(d.id);
      const after = await prisma.deliveryRequest.findUnique({
        where: { id: d.id },
        select: { stripeTransferId: true, paymentStatus: true },
      });
      // Trust the row, not the absence of an exception. A capture that returns
      // without creating a transfer is the exact failure this whole script
      // exists to clean up after.
      if (after?.stripeTransferId) {
        paid += 1;
        console.log(`  ${g('✓')} ${d.id.slice(0, 8)} → ${after.stripeTransferId} (${after.paymentStatus})`);
      } else {
        console.log(`  ${r('✗')} ${d.id.slice(0, 8)} — still no transfer id`);
      }
    } catch (err) {
      console.log(`  ${r('✗')} ${d.id.slice(0, 8)} — ${(err as Error).message}`);
    }
  }
  console.log(
    paid === stranded.length
      ? g(`\n  All ${paid} paid.\n`)
      : y(`\n  ${paid} of ${stranded.length} paid. The rest are listed above with their reason.\n`),
  );
}

main()
  .catch((e) => {
    console.error(r(`\n  ${String(e?.message ?? e)}\n`));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
