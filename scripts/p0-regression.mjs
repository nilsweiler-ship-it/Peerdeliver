#!/usr/bin/env node
/**
 * Regression suite for the seven P0 trust/money bugs found in the
 * 2026-10-30 review (reviews/2026-10-30/SUMMARY.md).
 *
 * Every check reproduces one of the original exploits and asserts that it no
 * longer works. Run it against a LOCAL server in simulated-payment mode (no
 * Stripe key): it registers throwaway users and pays with the sim TWINT
 * endpoint, which is deliberately unavailable once a real provider is set.
 *
 *   API=http://localhost:3001 node scripts/p0-regression.mjs
 *
 * Exits non-zero on any failure.
 */
const API = process.env.API || 'http://localhost:3001';
if (/shlep\.ch|onrender\.com/.test(API)) {
  console.error('Refusing to run against a deployed API. This suite creates users and deliveries.');
  process.exit(2);
}

let ip = 1;
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  :: ${JSON.stringify(detail).slice(0, 300)}`}`);
}
async function call(method, path, token, body) {
  const r = await fetch(`${API}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      // Spread requests over fake client IPs so the global per-IP limiter
      // does not turn a test run into a wall of 429s.
      'x-forwarded-for': `10.88.${Math.floor(ip / 250) % 250}.${ip++ % 250}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { s: r.status, j, d: j?.data };
}

const run = Date.now().toString(36);
async function reg(name, role, extra = {}) {
  const email = `p0-${name}-${run}@example.com`;
  const r = await call('POST', '/auth/register', null, {
    email, password: 'P0-Regression-1', firstName: name, lastName: 'Test', role, ...extra,
  });
  const tok = r.d?.tokens?.accessToken ?? r.d?.accessToken;
  if (!tok) throw new Error(`register ${name} failed: ${r.s} ${JSON.stringify(r.j)}`);
  return { email, tok, id: r.d?.user?.id };
}

const ZH = { label: 'Zürich HB', point: { lat: 47.3779, lng: 8.5403 } };
const WI = { label: 'Winterthur HB', point: { lat: 47.5001, lng: 8.7238 } };
const DAY = 864e5;
const car = { licensePlate: 'ZH 123456', vehicleSize: 'L', maxLoadKg: 100 };

const S = await reg('sender', 'both', car);
const D = await reg('driver', 'driver', car);
const D2 = await reg('driver2', 'driver', car);
const R = await reg('recipient', 'recipient');
const T = await reg('stranger', 'both', car);

const body = (over = {}) => ({
  pickupAddress: ZH, deliveryAddress: WI, recipientEmail: R.email,
  packageSize: 'M', packageWeight: 5, packageDescription: 'P0 box', budgetCHF: 20,
  deliveryWindowStart: new Date(Date.now() + DAY).toISOString(),
  deliveryWindowEnd: new Date(Date.now() + 2 * DAY).toISOString(), ...over,
});
async function create(over) {
  const c = await call('POST', '/deliveries', S.tok, body(over));
  if (!c.d?.id) throw new Error(`create failed: ${c.s} ${JSON.stringify(c.j)}`);
  return c.d.id;
}
const pay = (id) => call('POST', '/payments/twint/pay', S.tok, { deliveryRequestId: id });
const get = async (id, who = S) => (await call('GET', `/deliveries/${id}`, who.tok)).d;

/** Paid → claimed → confirmed → accepted. Returns the id. */
async function toAccepted(drv = D) {
  const id = await create();
  await pay(id);
  await call('PATCH', `/deliveries/${id}/assign`, drv.tok);
  await call('PATCH', `/deliveries/${id}/confirm`, S.tok);
  await call('PATCH', `/deliveries/${id}/status`, drv.tok, { status: 'accepted' });
  return id;
}
/** …and through the pickup, using the code as the sender would show it. */
async function toInTransit(drv = D) {
  const id = await toAccepted(drv);
  const { pickupCode } = await get(id, S);
  await call('POST', `/deliveries/${id}/verify-pickup`, drv.tok, { code: pickupCode });
  return id;
}
async function deliveryCodeFor(id) {
  return (await get(id, S)).deliveryCode;
}

// ── #1 Handover codes never reach the driver ────────────────────────────
console.log('\n#1 handover codes');
{
  const id = await create();
  await pay(id);
  const nearby = (await call('GET', `/deliveries/nearby?lat=${ZH.point.lat}&lng=${ZH.point.lng}`, D.tok)).d ?? [];
  const row = nearby.find((d) => d.id === id);
  check('paid delivery is listed for drivers', !!row, { listed: !!row });
  check('nearby list carries no codes', row && !('pickupCode' in row) && !('deliveryCode' in row), row);

  await call('PATCH', `/deliveries/${id}/assign`, D.tok);
  await call('PATCH', `/deliveries/${id}/confirm`, S.tok);
  await call('PATCH', `/deliveries/${id}/status`, D.tok, { status: 'accepted' });

  const asDriver = await get(id, D);
  check('driver GET /:id has no codes', asDriver && !asDriver.pickupCode && !asDriver.deliveryCode, asDriver);
  const mine = ((await call('GET', '/deliveries/mine', D.tok)).d ?? []).find((d) => d.id === id);
  check('driver /mine has no codes', mine && !mine.pickupCode && !mine.deliveryCode, mine);

  const asSender = await get(id, S);
  check('sender sees both codes', /^\d{6}$/.test(asSender?.pickupCode) && /^\d{6}$/.test(asSender?.deliveryCode), asSender);
  const asRecipient = ((await call('GET', '/deliveries/mine', R.tok)).d ?? []).find((d) => d.id === id);
  check('recipient sees the delivery code only', asRecipient && !asRecipient.pickupCode && /^\d{6}$/.test(asRecipient.deliveryCode), asRecipient);

  // The original exploit: the driver completes without ever being told a code.
  const guess = await call('POST', `/deliveries/${id}/verify-pickup`, D.tok, { code: asDriver?.pickupCode ?? '000000' });
  check('driver cannot verify pickup with what the API gave them', guess.s >= 400, { s: guess.s });
}

// ── #2 Strangers cannot read deliveries ─────────────────────────────────
console.log('\n#2 IDOR');
{
  const id = await create();
  const r = await call('GET', `/deliveries/${id}`, T.tok);
  check('stranger GET /:id → 404', r.s === 404, { s: r.s, leaked: r.d });
  check('…and nothing in the body', !r.d, r.d);
}

// ── #3 No refund after a good delivery ──────────────────────────────────
console.log('\n#3 refunds after payout');
{
  const id = await toInTransit();
  const done = await call('POST', `/deliveries/${id}/verify-delivery`, D.tok, { code: await deliveryCodeFor(id) });
  check('happy path delivers', done.d?.status === 'delivered', { s: done.s, st: done.d?.status });
  check('payout reported ok', done.d?.payout?.ok === true, done.d?.payout);

  const rej = await call('PATCH', `/deliveries/${id}/reject`, S.tok);
  check('sender cannot reject the driver of a delivered parcel', rej.s >= 400, { s: rej.s });
  const cx = await call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'x' });
  check('sender cannot cancel a delivered parcel', cx.s >= 400, { s: cx.s });
  const after = await get(id);
  check('still delivered, captured, not refunded',
    after?.status === 'delivered' && after?.paymentStatus === 'captured' && !after?.refundedCHF,
    { st: after?.status, pay: after?.paymentStatus, refunded: after?.refundedCHF });
  check('split 20 → fee 1.80 / payout 18.20', after?.platformFeeCHF === 1.8 && after?.driverPayoutCHF === 18.2,
    { fee: after?.platformFeeCHF, payout: after?.driverPayoutCHF });
}
{
  const id = await toInTransit();
  const r = await call('PATCH', `/deliveries/${id}/status`, R.tok, { status: 'cancelled', cancelReason: 'x' });
  check('recipient cannot cancel mid-transit', r.s === 403, { s: r.s });
  const s = await call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'x' });
  check('sender cannot cancel after pickup', s.s === 409, { s: s.s });
  const d = await get(id);
  check('in-transit hold untouched', d?.status === 'in_transit' && d?.paymentStatus === 'authorised', { st: d?.status, pay: d?.paymentStatus });
}
{
  const id = await toAccepted();
  const r = await call('PATCH', `/deliveries/${id}/status`, D.tok, { status: 'cancelled', cancelReason: 'car broke' });
  const d = await get(id);
  check('driver backing out returns the parcel to the pool', r.s === 200 && d?.status === 'pending' && !d?.driverId, { s: r.s, st: d?.status });
  check('…with the sender\'s payment still held', d?.paymentStatus === 'authorised', { pay: d?.paymentStatus });
}
{
  const id = await toAccepted();
  const r = await call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'changed my mind' });
  const d = await get(id);
  check('sender can still cancel before pickup, and is refunded', r.s === 200 && d?.status === 'cancelled' && d?.paymentStatus === 'refunded',
    { s: r.s, st: d?.status, pay: d?.paymentStatus });
  check('cancelledBy recorded', d?.cancelledBy === S.id, { cancelledBy: d?.cancelledBy });
}
{
  // The race the stress test reproduced: a cancel and the delivery code at once.
  // Run it several times; never may a delivery end delivered AND refunded.
  let bad = 0;
  for (let i = 0; i < 8; i++) {
    const id = await toInTransit();
    const code = await deliveryCodeFor(id);
    await Promise.all([
      call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'race' }),
      call('POST', `/deliveries/${id}/verify-delivery`, D.tok, { code }),
    ]);
    const d = await get(id);
    if (d?.status === 'delivered' && d?.paymentStatus !== 'captured') bad++;
    if (d?.refundedCHF && d?.driverPayoutCHF && d?.paymentStatus !== 'captured') bad++;
  }
  check('cancel racing verify-delivery never refunds a paid-out delivery (×8)', bad === 0, { bad });
}

// ── #4 The generic status endpoint cannot skip the codes ────────────────
console.log('\n#4 status bypass');
{
  const id = await toAccepted();
  for (const st of ['picked_up', 'in_transit', 'delivered']) {
    const r = await call('PATCH', `/deliveries/${id}/status`, D.tok, { status: st });
    check(`driver PATCH status=${st} refused`, r.s === 400, { s: r.s, st: r.d?.status });
  }
  const accBySender = await call('PATCH', `/deliveries/${(await create()).toString()}/status`, S.tok, { status: 'accepted' });
  check('sender cannot accept on the driver\'s behalf', accBySender.s >= 400, { s: accBySender.s });
}

// ── #5 Nothing is claimable before it is paid ───────────────────────────
console.log('\n#5 payment required');
{
  const id = await create();
  const nearby = (await call('GET', `/deliveries/nearby?lat=${ZH.point.lat}&lng=${ZH.point.lng}`, D.tok)).d ?? [];
  check('unpaid delivery hidden from drivers', !nearby.some((d) => d.id === id), {});
  const a = await call('PATCH', `/deliveries/${id}/assign`, D.tok);
  check('unpaid delivery cannot be claimed', a.s === 400, { s: a.s });
  const self = await create();
  await pay(self);
  const own = await call('PATCH', `/deliveries/${self}/assign`, S.tok);
  check('sender cannot claim their own delivery', own.s === 400, { s: own.s });
}

// ── #6 A handover completes exactly once ────────────────────────────────
console.log('\n#6 duplicate handover');
{
  const Dx = await reg('driverx', 'driver', car);
  const id = await toInTransit(Dx);
  const code = await deliveryCodeFor(id);
  const rs = await Promise.all(Array.from({ length: 10 }, () =>
    call('POST', `/deliveries/${id}/verify-delivery`, Dx.tok, { code })));
  const ok = rs.filter((r) => r.s === 200).length;
  check('10 simultaneous verify-delivery → exactly one succeeds', ok === 1, rs.map((r) => r.s));
  const prof = (await call('GET', '/users/profile', Dx.tok)).d;
  check('driver credited exactly one delivery', prof?.totalDeliveries === 1, { totalDeliveries: prof?.totalDeliveries });

  const id2 = await create();
  await pay(id2);
  await call('PATCH', `/deliveries/${id2}/assign`, D2.tok);
  const cs = await Promise.all([1, 2, 3].map(() => call('PATCH', `/deliveries/${id2}/confirm`, S.tok)));
  check('triple confirm → exactly one succeeds', cs.filter((r) => r.s === 200).length === 1, cs.map((r) => r.s));
}

// ── #7 Nobody makes themselves admin ────────────────────────────────────
console.log('\n#7 role escalation');
{
  const r = await call('PATCH', '/users/profile', T.tok, { role: 'admin' });
  check('PATCH role=admin refused', r.s === 400, { s: r.s, role: r.d?.role });
  const ok = await call('PATCH', '/users/profile', T.tok, { role: 'driver' });
  check('switching between ordinary roles still works', ok.s === 200 && ok.d?.role === 'driver', { s: ok.s, role: ok.d?.role });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
