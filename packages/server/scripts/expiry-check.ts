/**
 * Check the expiry job against a LOCAL database.
 *
 *   npm run test:expiry
 *
 * Expiry is about time passing, which an HTTP test cannot fake. So this
 * creates its own users and deliveries through the service layer, moves
 * their delivery windows into the past directly in the database, runs one
 * expiry pass, and checks what happened to each. Simulated payments only: it
 * refuses to run with a Stripe key, because it writes rows that a real
 * payment flow would try to act on.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { prisma } from '../src/config';
import { createDelivery } from '../src/services/delivery';
import { payWithTwint } from '../src/services/payment';
import { expireStale } from '../src/services/lifecycle';

if (process.env.STRIPE_SECRET_KEY) {
  console.error('Refusing to run with STRIPE_SECRET_KEY set. Use a local database in simulated-payment mode.');
  process.exit(2);
}

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  :: ${JSON.stringify(detail)}`}`);
}

const ZH = { label: 'Zürich HB', point: { lat: 47.3779, lng: 8.5403 } };
const WI = { label: 'Winterthur HB', point: { lat: 47.5001, lng: 8.7238 } };
const DAY = 86_400_000;

async function user(role: 'both' | 'driver') {
  return prisma.user.create({
    data: {
      email: `expiry-${role}-${randomUUID()}@example.com`,
      passwordHash: 'x', firstName: 'Expiry', lastName: role, role,
      verificationStatus: 'verified', phoneVerified: true, idVerified: true,
    },
  });
}

/** A paid delivery in `status`, whose window ended `hoursAgo` hours ago. */
async function delivery(senderId: string, driverId: string | null, status: string, hoursAgo: number): Promise<string> {
  const d = await createDelivery(senderId, {
    pickupAddress: ZH, deliveryAddress: WI, recipientEmail: `r-${randomUUID()}@example.com`,
    packageSize: 'M', packageWeight: 5, budgetCHF: 20,
    deliveryWindowStart: new Date(Date.now() + DAY).toISOString(),
    deliveryWindowEnd: new Date(Date.now() + 2 * DAY).toISOString(),
  } as any);
  const id = d.id;
  if (!id) throw new Error('createDelivery returned no id');
  await payWithTwint(id, senderId);
  const end = new Date(Date.now() - hoursAgo * 3_600_000);
  await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET status = $2::"DeliveryStatus", "driverId" = $3,
            "deliveryWindowStart" = $4, "deliveryWindowEnd" = $5
      WHERE id = $1`,
    id, status, driverId, new Date(end.getTime() - DAY), end,
  );
  return id;
}

async function state(id: string) {
  return prisma.deliveryRequest.findUnique({
    where: { id },
    select: { status: true, paymentStatus: true, refundedCHF: true, disputeOpenedAt: true },
  });
}

async function main() {
  const sender = await user('both');
  const driver = await user('driver');

  const cases = {
    pendingPast: await delivery(sender.id, null, 'pending', 1),
    requestedPast: await delivery(sender.id, driver.id, 'requested', 1),
    pendingFuture: await delivery(sender.id, null, 'pending', -24), // window ends tomorrow
    matchedRecent: await delivery(sender.id, driver.id, 'matched', 2), // within the 24 h grace
    acceptedNoShow: await delivery(sender.id, driver.id, 'accepted', 30),
    inTransitRecent: await delivery(sender.id, driver.id, 'in_transit', 10), // within the 48 h grace
    inTransitStuck: await delivery(sender.id, driver.id, 'in_transit', 60),
  };

  const result = await expireStale();
  const again = await expireStale();

  const s = Object.fromEntries(await Promise.all(Object.entries(cases).map(async ([k, id]) => [k, await state(id)])));

  check('pending past its window → expired, refunded', s.pendingPast?.status === 'expired' && s.pendingPast?.paymentStatus === 'refunded', s.pendingPast);
  check('requested past its window → expired, refunded', s.requestedPast?.status === 'expired' && s.requestedPast?.paymentStatus === 'refunded', s.requestedPast);
  check('pending with a future window untouched', s.pendingFuture?.status === 'pending' && s.pendingFuture?.paymentStatus === 'authorised', s.pendingFuture);
  check('matched, window just passed (grace) untouched', s.matchedRecent?.status === 'matched', s.matchedRecent);
  check('accepted, never collected after 24 h → expired, refunded', s.acceptedNoShow?.status === 'expired' && s.acceptedNoShow?.paymentStatus === 'refunded', s.acceptedNoShow);
  check('in transit, within 48 h grace untouched', s.inTransitRecent?.status === 'in_transit', s.inTransitRecent);
  check('in transit, stuck past 48 h → disputed, money still held',
    s.inTransitStuck?.status === 'disputed' && s.inTransitStuck?.paymentStatus === 'authorised' && !!s.inTransitStuck?.disputeOpenedAt,
    s.inTransitStuck);
  const mine = new Set(Object.values(cases));
  const secondTouchedMine = [...again.expired, ...again.noShows, ...again.stuck].filter((id) => mine.has(id));
  check('a second pass changes nothing (each row handled once)', secondTouchedMine.length === 0, secondTouchedMine);
  check('first pass reported them', result.expired.includes(cases.pendingPast) && result.noShows.includes(cases.acceptedNoShow) && result.stuck.includes(cases.inTransitStuck), result);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
