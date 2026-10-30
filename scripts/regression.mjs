#!/usr/bin/env node
/**
 * Regression suite for the trust/money bugs found in the 2026-10-30 review
 * (reviews/2026-10-30/SUMMARY.md): the seven P0s, the follow-ups from the
 * independent review, and the pre-pilot (P1) behaviour — ID verification
 * before driving, disputes, ratings, input validation, account deletion.
 *
 * Every check reproduces an original exploit or a missing behaviour and
 * asserts it is fixed. Run it against a LOCAL server in simulated-payment mode (no
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
/** Drivers must be verified to drive. Locally that is the dev shortcut. */
async function verified(user) {
  const v = await call('POST', '/users/verification/dev-verify-all', user.tok);
  if (v.s !== 200) throw new Error(`dev-verify-all failed (${v.s}) — is the server in development mode without a live Stripe key?`);
  return user;
}

const ZH = { label: 'Zürich HB', point: { lat: 47.3779, lng: 8.5403 } };
const WI = { label: 'Winterthur HB', point: { lat: 47.5001, lng: 8.7238 } };
const DAY = 864e5;
const car = { licensePlate: 'ZH 123456', vehicleSize: 'L', maxLoadKg: 100 };

// Verified too, so that 'cannot claim your own parcel' is tested for itself
// rather than refused earlier for being unverified.
const S = await verified(await reg('sender', 'both', car));
const D = await verified(await reg('driver', 'driver', car));
const D2 = await verified(await reg('driver2', 'driver', car));
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
  const Dx = await verified(await reg('driverx', 'driver', car));
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

// ── Follow-ups from the independent review ──────────────────────────────
console.log('\n#1b no code via a second account under the recipient\'s email');
{
  // The driver can no longer even see the recipient's address…
  const id = await toAccepted();
  const asDriver = await get(id, D);
  check('driver view has no recipient contact or payment refs',
    asDriver && !asDriver.recipientEmail && !asDriver.recipientPhone && !asDriver.stripePaymentIntentId && !asDriver.twintPhone, asDriver);
  // …and could not use it if they had it: same mailbox, different case.
  const dup = await call('POST', '/auth/register', null, {
    email: R.email.toUpperCase(), password: 'P0-Regression-1', firstName: 'Mallory', lastName: 'X', role: 'recipient',
  });
  check('second account for the same mailbox in other case refused', dup.s === 409, { s: dup.s });
  const login = await call('POST', '/auth/login', null, { email: R.email.toUpperCase(), password: 'P0-Regression-1' });
  check('login is case-insensitive', login.s === 200, { s: login.s });

  // A recipient who signs up only after the delivery exists is matched by
  // email: they see the delivery, but the code reaches them by mail/SMS only.
  const lateEmail = `p0-late-${run}@example.com`;
  const lid = (await call('POST', '/deliveries', S.tok, body({ recipientEmail: lateEmail }))).d.id;
  await pay(lid);
  const late = await call('POST', '/auth/register', null, {
    email: lateEmail, password: 'P0-Regression-1', firstName: 'Late', lastName: 'R', role: 'recipient',
  });
  const lateTok = late.d?.tokens?.accessToken;
  const lateView = ((await call('GET', '/deliveries/mine', lateTok)).d ?? []).find((d) => d.id === lid);
  check('email-matched recipient sees the delivery', !!lateView, {});
  check('…but not the code (unverified email)', lateView && !lateView.deliveryCode && !lateView.pickupCode, lateView);
}

console.log('\n#1c open-job list shows only the job');
{
  const id = await create();
  await pay(id);
  const row = ((await call('GET', `/deliveries/nearby?lat=${ZH.point.lat}&lng=${ZH.point.lng}`, D2.tok)).d ?? []).find((d) => d.id === id);
  const leaked = row && ['recipientEmail', 'recipientPhone', 'twintPhone', 'twintRef', 'stripePaymentIntentId', 'paymentStatus']
    .filter((k) => k in row);
  check('nearby row has no contact or payment fields', row && leaked.length === 0, { leaked });
}

console.log('\n#2b wrong-code lockout');
{
  const id = await toAccepted();
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await call('POST', `/deliveries/${id}/verify-pickup`, D.tok, { code: String(100000 + i) })).s);
  const { pickupCode } = await get(id, S);
  // Make sure none of the guesses happened to be right.
  const guessedRight = [0, 1, 2, 3, 4].some((i) => String(100000 + i) === pickupCode);
  check('4 wrong codes → 400, the 5th → 429', guessedRight || (codes.slice(0, 4).every((s) => s === 400) && codes[4] === 429), codes);
  const right = await call('POST', `/deliveries/${id}/verify-pickup`, D.tok, { code: pickupCode });
  check('while locked, even the right code is refused', guessedRight || right.s === 429, { s: right.s });
  const msgs = (await call('GET', `/chat/${id}/messages`, S.tok)).d ?? [];
  check('sender is told in the chat', JSON.stringify(msgs).includes('wrong pickup codes'), { n: msgs.length });
}

console.log('\n#5b nothing offered or paid out of order');
{
  const id = await create();
  const route = await call('POST', '/routes', D2.tok, {
    originAddress: ZH.label, originPoint: ZH.point, destinationAddress: WI.label, destinationPoint: WI.point,
    routeType: 'one_time', departureTime: new Date(Date.now() + DAY).toISOString(), availableSize: 'L',
  });
  if (route.d?.id) {
    const off = await call('POST', `/deliveries/${id}/offer`, S.tok, { routeId: route.d.id });
    check('unpaid delivery cannot be offered to a route', off.s === 400, { s: off.s });
  } else {
    check('unpaid delivery cannot be offered to a route (route setup)', false, { s: route.s, e: route.j?.error });
  }
  await call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'x' });
  const late = await pay(id);
  check('a cancelled delivery cannot be paid', late.s === 400, { s: late.s });
}

console.log('\n#7b driver backing out is announced');
{
  const id = await toAccepted();
  await call('PATCH', `/deliveries/${id}/status`, D.tok, { status: 'cancelled', cancelReason: 'flat tyre' });
  const msgs = (await call('GET', `/chat/${id}/messages`, S.tok)).d ?? [];
  check('sender sees a chat message', JSON.stringify(msgs).includes('can no longer do this delivery'), { n: msgs.length });
}

// ── P1: ID verification before driving ─────────────────────────────────
console.log('\nP1 verification gate');
{
  const U = await reg('unverified', 'driver', car);
  const id = await create();
  await pay(id);
  const a = await call('PATCH', `/deliveries/${id}/assign`, U.tok);
  check('unverified driver cannot claim', a.s === 403 && a.j?.code === 'VERIFICATION_REQUIRED', { s: a.s, code: a.j?.code });
  const routeBody = {
    originAddress: ZH.label, originPoint: ZH.point, destinationAddress: WI.label, destinationPoint: WI.point,
    routeType: 'one_time', departureTime: new Date(Date.now() + DAY).toISOString(), availableSize: 'L',
  };
  const r = await call('POST', '/routes', U.tok, routeBody);
  check('unverified driver cannot publish a route', r.s === 403 && r.j?.code === 'VERIFICATION_REQUIRED', { s: r.s });
  const ok = await call('POST', '/routes', D.tok, routeBody);
  check('verified driver can publish', ok.s === 201, { s: ok.s, e: ok.j?.error });
}

// ── P1: disputes ────────────────────────────────────────────────────────
console.log('\nP1 disputes');
{
  const early = await create();
  const e = await call('POST', `/deliveries/${early}/dispute`, S.tok, { reason: 'Something is wrong here' });
  check('no dispute before pickup (cancel instead)', e.s === 400, { s: e.s });

  const id = await toInTransit();
  const short = await call('POST', `/deliveries/${id}/dispute`, S.tok, { reason: 'bad' });
  check('a reason is required', short.s === 400, { s: short.s });
  const stranger = await call('POST', `/deliveries/${id}/dispute`, T.tok, { reason: 'I am not part of this delivery' });
  check('a stranger cannot open one', stranger.s === 404, { s: stranger.s });
  const open = await call('POST', `/deliveries/${id}/dispute`, S.tok, { reason: 'The parcel was due yesterday and nobody answers.' });
  const d = await get(id);
  check('sender opens a dispute in transit → disputed, money held', open.s === 200 && d?.status === 'disputed' && d?.paymentStatus === 'authorised',
    { s: open.s, st: d?.status, pay: d?.paymentStatus });
  const twice = await call('POST', `/deliveries/${id}/dispute`, R.tok, { reason: 'Still not here, reporting again.' });
  check('only one open dispute at a time', twice.s === 409, { s: twice.s });
  const cx = await call('PATCH', `/deliveries/${id}/status`, S.tok, { status: 'cancelled', cancelReason: 'x' });
  check('a disputed delivery cannot be cancelled by the sender', cx.s >= 400, { s: cx.s });
  const done = await call('POST', `/deliveries/${id}/verify-delivery`, D.tok, { code: await deliveryCodeFor(id) });
  const after = await get(id);
  check('the recipient\'s code still completes it and settles the dispute',
    done.s === 200 && after?.status === 'delivered' && after?.paymentStatus === 'captured' && !!after?.disputeResolvedAt,
    { s: done.s, st: after?.status, pay: after?.paymentStatus, resolved: after?.disputeResolvedAt });
}

// ── P1: ratings ─────────────────────────────────────────────────────────
console.log('\nP1 ratings');
{
  const Dr = await verified(await reg('rated', 'driver', car));
  const id = await toInTransit(Dr);
  const early = await call('POST', `/deliveries/${id}/rating`, S.tok, { score: 5 });
  check('no rating before delivery', early.s === 400, { s: early.s });
  await call('POST', `/deliveries/${id}/verify-delivery`, Dr.tok, { code: await deliveryCodeFor(id) });
  const bad = await call('POST', `/deliveries/${id}/rating`, S.tok, { score: 7 });
  check('score must be 1–5', bad.s === 400, { s: bad.s });
  const r1 = await call('POST', `/deliveries/${id}/rating`, S.tok, { score: 4, comment: 'Friendly and on time' });
  check('sender rates the driver', r1.s === 201 && r1.d?.score === 4, { s: r1.s });
  const r2 = await call('POST', `/deliveries/${id}/rating`, S.tok, { score: 1 });
  check('…once', r2.s === 409, { s: r2.s });
  const r3 = await call('POST', `/deliveries/${id}/rating`, R.tok, { score: 5 });
  check('the recipient can rate the driver too', r3.s === 201, { s: r3.s });
  const prof = (await call('GET', '/users/profile', Dr.tok)).d;
  check('driver average = 4.5 from 2 ratings', prof?.totalRatings === 2 && Math.abs((prof?.averageRating ?? 0) - 4.5) < 1e-9,
    { avg: prof?.averageRating, n: prof?.totalRatings });
  const mine = await call('GET', `/deliveries/${id}/rating`, S.tok);
  check('GET returns my rating', mine.d?.score === 4, mine.d);
  const back = await call('POST', `/deliveries/${id}/rating`, Dr.tok, { score: 5 });
  check('the driver rates the sender', back.s === 201, { s: back.s });
}

// ── P1: input validation ────────────────────────────────────────────────
console.log('\nP1 validation');
{
  const bad = async (name, over, expectText) => {
    const r = await call('POST', '/deliveries', S.tok, body(over));
    check(`refused: ${name}`, r.s === 400 && (!expectText || String(r.j?.error).includes(expectText)), { s: r.s, e: r.j?.error });
  };
  await bad('budget CHF 12.34 (off the 5-Rappen grid)', { budgetCHF: 12.34 }, 'Rappen');
  await bad('budget CHF 1', { budgetCHF: 1 });
  await bad('budget CHF 6000 (over TWINT limit)', { budgetCHF: 6000 });
  await bad('9999 kg as size S', { packageSize: 'S', packageWeight: 9999 }, 'kg');
  await bad('declared value 1e12', { declaredValue: 1e12 });
  await bad('window in the past', { deliveryWindowStart: new Date(Date.now() - 3 * DAY).toISOString(), deliveryWindowEnd: new Date(Date.now() - 2 * DAY).toISOString() });
  await bad('window ending before it starts', { deliveryWindowStart: new Date(Date.now() + 2 * DAY).toISOString(), deliveryWindowEnd: new Date(Date.now() + DAY).toISOString() });
  await bad('pickup at (0,0)', { pickupAddress: { label: 'Null Island', point: { lat: 0, lng: 0 } } });
  await bad('pickup = drop-off', { deliveryAddress: ZH });

  const offset = await call('POST', '/deliveries', S.tok, body({
    deliveryWindowStart: '2099-01-01T09:00:00+01:00', deliveryWindowEnd: '2099-01-02T09:00:00+01:00',
  }));
  check('far future refused, but the +01:00 offset is understood', offset.s === 400 && /Voraus/.test(offset.j?.error ?? ''), { s: offset.s, e: offset.j?.error });
  const soon = new Date(Date.now() + DAY);
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00:00+00:00`;
  const ok = await call('POST', '/deliveries', S.tok, body({ deliveryWindowStart: local(soon), deliveryWindowEnd: local(new Date(soon.getTime() + DAY)) }));
  check('a datetime with an offset is accepted', ok.s === 201, { s: ok.s, e: ok.j?.error });

  const grid = await create({ budgetCHF: 12.35 });
  await pay(grid);
  await call('PATCH', `/deliveries/${grid}/assign`, D2.tok);
  await call('PATCH', `/deliveries/${grid}/confirm`, S.tok);
  await call('PATCH', `/deliveries/${grid}/status`, D2.tok, { status: 'accepted' });
  await call('POST', `/deliveries/${grid}/verify-pickup`, D2.tok, { code: (await get(grid, S)).pickupCode });
  await call('POST', `/deliveries/${grid}/verify-delivery`, D2.tok, { code: await deliveryCodeFor(grid) });
  const g = await get(grid);
  check('CHF 12.35 → fee 1.50 / payout 10.85, both on the grid', g?.platformFeeCHF === 1.5 && g?.driverPayoutCHF === 10.85,
    { fee: g?.platformFeeCHF, payout: g?.driverPayoutCHF });

  const lang = await call('PATCH', '/users/profile', T.tok, { language: 'klingon' });
  check('profile: unknown language refused', lang.s === 400, { s: lang.s });
  const veh = await call('PATCH', '/users/profile', T.tok, { vehicleSize: 'HUGE', maxLoadKg: -50 });
  check('profile: bad vehicle fields → 400, not 500', veh.s === 400, { s: veh.s });
  const it = await call('POST', '/auth/register', null, {
    email: `p0-it-${run}@example.com`, password: 'P0-Regression-1', firstName: 'Lia', lastName: 'Ticino', role: 'sender', language: 'it',
  });
  check('Italian accepted at sign-up', it.s === 201 && it.d?.user?.language === 'it', { s: it.s, lang: it.d?.user?.language });

  const chatId = await toAccepted();
  const empty = await call('POST', `/chat/${chatId}/messages`, S.tok, { content: '   ' });
  check('chat: empty message → 400, not 500', empty.s === 400, { s: empty.s });
  const long = await call('POST', `/chat/${chatId}/messages`, S.tok, { content: 'x'.repeat(3000) });
  check('chat: 3000 characters → 400', long.s === 400, { s: long.s });
}

// ── P1: account deletion ────────────────────────────────────────────────
console.log('\nP1 account deletion');
{
  const X = await reg('leaver', 'both', car);
  const busy = (await call('POST', '/deliveries', X.tok, body())).d.id;
  const blocked = await call('DELETE', '/users/account', X.tok);
  check('refused while a delivery is in progress', blocked.s === 409, { s: blocked.s });
  await call('PATCH', `/deliveries/${busy}/status`, X.tok, { status: 'cancelled', cancelReason: 'leaving' });
  const del = await call('DELETE', '/users/account', X.tok);
  check('then deletes (anonymises, since a past delivery refers to it)', del.s === 200, { s: del.s, e: del.j?.error });
  const login = await call('POST', '/auth/login', null, { email: X.email, password: 'P0-Regression-1' });
  check('the old login no longer works', login.s === 401, { s: login.s });
  const fresh = await reg('leaver2', 'sender');
  const del2 = await call('DELETE', '/users/account', fresh.tok);
  check('an account with no history is deleted outright', del2.s === 200, { s: del2.s });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
