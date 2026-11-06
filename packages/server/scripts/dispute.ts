/**
 * Look at and settle disputes.
 *
 *   npm run dispute                                  # list open disputes
 *   npm run dispute -- show <id>                     # one case, with its chat
 *   npm run dispute -- deliver <id> "note" --run     # complete it; the driver is paid
 *   npm run dispute -- refund  <id> "note" --run     # refund the sender
 *
 * A dispute is opened by the sender, the driver or the recipient from the app
 * ("Report a problem"), or automatically when a collected parcel is still not
 * delivered 48 hours after its window. While open, the money stays where it
 * is: a driver is not paid out and a sender is not refunded until someone has
 * looked at the case and run one of the two commands above.
 *
 * Without --run, deliver/refund only say what they would do. Moving money
 * should take more than a typo.
 */
import 'dotenv/config';
import { prisma } from '../src/config';
import { resolveDispute } from '../src/services/lifecycle';

const [cmd, id, note] = process.argv.slice(2).filter((a) => a !== '--run');
const run = process.argv.includes('--run');

async function list() {
  const rows = await prisma.deliveryRequest.findMany({
    where: { disputeOpenedAt: { not: null }, disputeResolvedAt: null },
    orderBy: { disputeOpenedAt: 'asc' },
    select: { id: true, status: true, paymentStatus: true, budgetCHF: true, disputeOpenedAt: true, disputeReason: true },
  });
  if (!rows.length) return console.log('No open disputes.');
  for (const r of rows) {
    console.log(`${r.id}  ${r.status}/${r.paymentStatus}  CHF ${r.budgetCHF}  opened ${r.disputeOpenedAt?.toISOString()}`);
    console.log(`   ${r.disputeReason}`);
  }
}

async function show(deliveryId: string) {
  const d = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    include: {
      sender: { select: { firstName: true, lastName: true, email: true, phone: true } },
      driver: { select: { firstName: true, lastName: true, email: true, phone: true, licensePlate: true } },
      messages: { orderBy: { createdAt: 'asc' }, select: { createdAt: true, senderId: true, content: true } },
    },
  });
  if (!d) return console.log('Not found.');
  console.log(JSON.stringify({
    id: d.id, status: d.status, payment: d.paymentStatus, budgetCHF: d.budgetCHF,
    route: `${d.pickupLabel} → ${d.deliveryLabel}`, window: [d.deliveryWindowStart, d.deliveryWindowEnd],
    sender: d.sender, driver: d.driver, recipient: d.recipientEmail ?? d.recipientPhone,
    dispute: { openedAt: d.disputeOpenedAt, by: d.disputeOpenedById, reason: d.disputeReason, resolvedAt: d.disputeResolvedAt, resolution: d.disputeResolution },
  }, null, 2));
  console.log('\nChat:');
  for (const m of d.messages) console.log(`  ${m.createdAt.toISOString()}  ${m.senderId.slice(0, 8)}  ${m.content}`);
}

async function main() {
  if (!cmd) return list();
  if (cmd === 'show' && id) return show(id);
  if ((cmd === 'deliver' || cmd === 'refund') && id) {
    if (!run) {
      console.log(`Dry run: would ${cmd === 'deliver' ? 'complete the delivery and pay the driver' : 'refund the sender'} for ${id}.`);
      console.log('Add --run to do it.');
      return;
    }
    console.log(await resolveDispute(id, cmd, note ?? ''));
    return;
  }
  console.log('Usage: npm run dispute [-- show|deliver|refund <id> ["note"] [--run]]');
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
