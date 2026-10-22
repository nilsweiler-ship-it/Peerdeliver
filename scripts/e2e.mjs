#!/usr/bin/env node
/**
 * The whole money lifecycle, end to end, with no phone involved.
 *
 *   npm run e2e
 *
 * Needs two secrets:
 *   STRIPE_SECRET_KEY   a test key (sk_test_…) for the account the API uses
 *   E2E_PASSWORD        the password set by scripts/seed-e2e-users.ts
 *
 * and optionally API_URL, defaulting to the deployed test-mode service.
 *
 *
 * WHY THIS EXISTS
 *
 * Getting one payment through by hand took the better part of a week, and
 * every fault it exposed was invisible until something downstream failed:
 *
 *   · a webhook endpoint that existed only in live mode, so no test payment
 *     was ever announced and every delivery sat 'unpaid'
 *   · a publishable key from a different Stripe account than the secret key
 *   · an onboarding link built with a custom URL scheme, which Stripe refuses
 *   · transfers drawing on an available balance that is always empty at the
 *     moment a delivery completes, so no driver could ever have been paid
 *
 * Each one was a single wrong value, and each took hours because the symptom
 * appeared several steps away from the cause. They are all one assertion each.
 *
 *
 * WHAT IT DOES NOT COVER
 *
 * The Stripe payment sheet rendering on a device, TWINT specifically, and
 * anything with live money. The sheet is replaced here by confirming the
 * PaymentIntent server-side with a test card, which exercises every part of
 * the chain except the pixels. Those three stay a short manual check.
 *
 * It touches no database: it drives the public API as three real users and
 * reads Stripe directly. That is deliberate — the database sits behind an IP
 * allow list a CI runner will never be on.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Read packages/server/.env, if it is there.
 *
 * The two secrets this needs already live in that file for the seed script
 * and the server, and asking for them inline on every run is how a
 * placeholder ends up pasted into a command. Values already set in the
 * environment win, so CI — which has no .env — is unaffected.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

(() => {
  const root = ROOT;
  const envPath = join(root, 'packages/server/.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    // An empty assignment is not a value. A leftover `STRIPE_SECRET_KEY=`
    // from .env.example sat above the real one and shadowed it, because both
    // this and dotenv keep the first occurrence — producing "not set" for a
    // key that was right there two lines below.
    if (!value) continue;
    if (process.env[key]) continue;
    process.env[key] = value;
  }
})();

const API = (process.env.API_URL || 'https://api.shlep.ch').replace(/\/$/, '');
const KEY = process.env.STRIPE_SECRET_KEY;
const PASSWORD = process.env.E2E_PASSWORD;

const USERS = {
  sender: 'e2e-sender@shlep.ch',
  driver: 'e2e-driver@shlep.ch',
  recipient: 'e2e-recipient@shlep.ch',
};

// Pfungen → Schaffhausen. A real Swiss corridor, well inside the 30 km
// endpoint tolerance and the driver list's search radius.
const PFUNGEN = { lat: 47.5098, lng: 8.6424 };
const SCHAFFHAUSEN = { lat: 47.6959, lng: 8.6349 };

const BUDGET = 25;
const EXPECTED_FEE = 2.25;
const EXPECTED_PAYOUT = 22.75;

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
const failures = [];
const blocked = [];

/**
 * A step that cannot run because an earlier one failed.
 *
 * Reported apart from a real failure: one missing driver onboarding produced
 * six red lines, five of which were consequences. A list of failures is only
 * useful if every entry is a separate thing to fix.
 *
 * Not counted as passed either — the point is that it is unknown.
 */
function blockedBy(name, reason) {
  blocked.push(name);
  log.push({ step: name, result: 'blocked', detail: reason });
  console.log(`  ${y('–')} ${name}  ${dim(`blocked: ${reason}`)}`);
}

// Every line, in order, for the report written at the end.
const log = [];

function check(name, condition, detail = '') {
  log.push({ step: name, result: condition ? 'pass' : 'fail', detail: detail || null });
  if (condition) {
    passed += 1;
    console.log(`  ${g('✓')} ${name}${detail ? dim('  ' + detail) : ''}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ${r('✗')} ${name}${detail ? '  ' + r(detail) : ''}`);
  }
  return condition;
}

/**
 * Write the run to a file the next person can read without being handed it.
 *
 * Reports went back and forth by copy-paste, which is slow, lossy, and drops
 * exactly the detail that matters when a line is long. A file in the repo is
 * readable by anything with access to the folder — including whoever is
 * helping debug it.
 *
 * Gitignored: it is a record of one run, not of the project.
 */
function writeReport(status) {
  try {
    mkdirSync(join(ROOT, '.reports'), { recursive: true });
    writeFileSync(
      join(ROOT, '.reports/e2e.json'),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          api: API,
          status,
          passed,
          failed: failures.length,
          blocked: blocked.length,
          failures,
          blockedSteps: blocked,
          steps: log,
        },
        null,
        2,
      ),
    );
  } catch {
    // A report is a convenience. Never fail a run because one could not be written.
  }
}

function fatal(message, hint = '') {
  console.error(r(`\n  ${message}\n`));
  if (hint) console.error(dim(`  ${hint}\n`));
  log.push({ step: message, result: 'fatal', detail: hint || null });
  writeReport('fatal');
  process.exit(1);
}

// ── Transport ───────────────────────────────────────────────────────────────

async function api(path, { method = 'GET', token, body } = {}) {
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    // An unreachable API throws rather than returning a status, and an
    // unhandled rejection buries the one useful fact in a stack trace.
    return { status: 0, ok: false, body: null, raw: `cannot reach ${API}: ${e?.cause?.code ?? e.message}` };
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, ok: res.ok, body: json, raw: text.slice(0, 300) };
}

/** Stripe REST via curl — no SDK, so this runs anywhere Node and curl do. */
function stripe(method, path, params = {}) {
  const flat = [];
  const walk = (prefix, value) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(`${prefix}[${k}]`, v);
    else flat.push([prefix, String(value)]);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);

  const args = ['-s', '-X', method, `https://api.stripe.com/v1${path}`, '-u', `${KEY}:`];
  for (const [k, v] of flat) args.push('-d', `${k}=${v}`);
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 8 << 20 });
    const parsed = JSON.parse(out);
    if (parsed?.error) return { ok: false, error: parsed.error, data: null };
    return { ok: true, data: parsed, error: null };
  } catch (e) {
    return { ok: false, error: { message: String(e.message).slice(0, 200) }, data: null };
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Wait for a field to reach a value, because the webhook is asynchronous.
 * Polling rather than a fixed sleep: a fixed sleep is either flaky or slow,
 * and usually manages both.
 */
async function waitFor(label, token, deliveryId, predicate, timeoutMs = 45000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const res = await api(`/deliveries/${deliveryId}`, { token });
    last = res.body?.data;
    if (last && predicate(last)) return last;
    await sleep(1500);
  }
  console.log(dim(`      gave up after ${Math.round((Date.now() - started) / 1000)}s waiting for ${label}`));
  return last;
}

// ── Preconditions ───────────────────────────────────────────────────────────

if (!KEY) fatal('STRIPE_SECRET_KEY is not set.', 'A test key: sk_test_… from dashboard.stripe.com/test/apikeys');
if (KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_')) {
  fatal('That is a LIVE Stripe key. This suite creates payments and transfers.');
}
if (!/^(sk|rk)_test_/.test(KEY)) fatal(`"${KEY.slice(0, 8)}" is not a test key prefix.`);
if (!PASSWORD) {
  fatal('E2E_PASSWORD is not set.', 'The password used by scripts/seed-e2e-users.ts. Run npm run e2e:seed first.');
}

console.log(bold('\nShlep — end to end') + dim(`  ${API}`));
console.log(dim('─'.repeat(74)));

// ── 0. Sign in as all three ─────────────────────────────────────────────────

console.log(bold('\n0 · Accounts'));
const tokens = {};
for (const [role, email] of Object.entries(USERS)) {
  const res = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  const d = res.body?.data;
  const token = d?.tokens?.accessToken ?? d?.accessToken ?? d?.token;
  const detail = !res.ok
    ? `${res.status} ${res.body?.error ?? res.raw}`
    : token
      ? ''
      : `signed in but no token in the response — keys: ${Object.keys(d ?? {}).join(', ') || 'none'}`;
  if (!check(`sign in as ${role}`, res.ok && !!token, detail)) {
    fatal('Cannot continue without all three accounts.', 'Run: npm run e2e:seed');
  }
  tokens[role] = token;
}

// ── 1. The driver publishes a route ─────────────────────────────────────────

console.log(bold('\n1 · Driver publishes a route'));
const departure = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
const routeRes = await api('/routes', {
  method: 'POST',
  token: tokens.driver,
  body: {
    originAddress: 'Pfungen',
    originPoint: PFUNGEN,
    destinationAddress: 'Schaffhausen',
    destinationPoint: SCHAFFHAUSEN,
    routeType: 'one_time',
    departureTime: departure,
    availableSize: 'XL',
    maxDetourMinutes: 20,
  },
});
const routeId = routeRes.body?.data?.id;
check('route created', routeRes.ok && !!routeId, routeRes.ok ? dim(routeId ?? '') : `${routeRes.status} ${routeRes.body?.error ?? routeRes.raw}`);

// ── 2. The sender creates a delivery on that corridor ───────────────────────

console.log(bold('\n2 · Sender creates a delivery'));
const now = Date.now();
const createRes = await api('/deliveries', {
  method: 'POST',
  token: tokens.sender,
  body: {
    pickupAddress: { label: 'Pfungen', point: PFUNGEN },
    deliveryAddress: { label: 'Schaffhausen', point: SCHAFFHAUSEN },
    recipientEmail: USERS.recipient,
    packageSize: 'L',
    packageWeight: 12,
    packageDescription: `e2e ${new Date(now).toISOString()}`,
    packaging: 'none',
    budgetCHF: BUDGET,
    deliveryWindowStart: new Date(now + 24 * 3600 * 1000).toISOString(),
    deliveryWindowEnd: new Date(now + 48 * 3600 * 1000).toISOString(),
  },
});
const delivery = createRes.body?.data;
const deliveryId = delivery?.id;
if (!check('delivery created', createRes.ok && !!deliveryId, createRes.ok ? dim(deliveryId ?? '') : `${createRes.status} ${createRes.body?.error ?? createRes.raw}`)) {
  fatal('Nothing further can run without a delivery.');
}

const clientSecret = delivery?.clientSecret;
check(
  'server is in real Stripe mode',
  !!clientSecret,
  clientSecret ? dim('clientSecret returned') : 'no clientSecret — STRIPE_SECRET_KEY is not set on the API',
);
const intentId = clientSecret ? clientSecret.split('_secret_')[0] : null;

// ── 3. Pay it, as the payment sheet would ───────────────────────────────────

console.log(bold('\n3 · Payment'));
if (intentId) {
  const confirmed = stripe('POST', `/payment_intents/${intentId}/confirm`, {
    payment_method: 'pm_card_visa',
    return_url: 'https://shlep.ch/payout-return.html',
  });
  check(
    'card payment succeeds',
    confirmed.ok && confirmed.data?.status === 'succeeded',
    confirmed.ok ? dim(confirmed.data?.status ?? '') : confirmed.error.message.slice(0, 90),
  );

  // The webhook is the only thing that tells the server. This is the fault
  // that left five deliveries 'unpaid' with the money already taken.
  const afterPay = await waitFor('the webhook', tokens.sender, deliveryId, (d) => d.paymentStatus === 'authorised');
  check(
    'webhook marks the delivery authorised',
    afterPay?.paymentStatus === 'authorised',
    afterPay?.paymentStatus === 'authorised'
      ? ''
      : `still "${afterPay?.paymentStatus}" — check the TEST-mode webhook endpoint and its signing secret`,
  );
}

// ── 4. The driver takes it ──────────────────────────────────────────────────

console.log(bold('\n4 · Driver accepts and collects'));
const nearby = await api(`/deliveries/nearby?lat=${PFUNGEN.lat}&lng=${PFUNGEN.lng}&radius=50`, { token: tokens.driver });
const visible = (nearby.body?.data ?? []).some((d) => d.id === deliveryId);
check('delivery is visible to the driver', visible, visible ? '' : "filtered out — check the driver's profile vehicle size and max load");

const assigned = await api(`/deliveries/${deliveryId}/assign`, { method: 'PATCH', token: tokens.driver });
const assignedOk = check(
  'driver assigned',
  assigned.ok,
  assigned.ok ? '' : `${assigned.status} ${assigned.body?.error ?? assigned.raw}`,
);
// Everything from here needs a driver on the delivery. Without one the API
// answers 403 to each step in turn, which says nothing beyond the line above.
const blockReason = assignedOk ? null : (assigned.body?.error ?? `HTTP ${assigned.status}`);

const senderView = await api(`/deliveries/${deliveryId}`, { token: tokens.sender });
const pickupCode = senderView.body?.data?.pickupCode;
check('sender can read the pickup code', !!pickupCode);

if (blockReason) {
  blockedBy('a wrong pickup code is refused', blockReason);
  blockedBy('the right pickup code is accepted', blockReason);
} else {
  const badPickup = await api(`/deliveries/${deliveryId}/verify-pickup`, {
    method: 'POST',
    token: tokens.driver,
    body: { code: pickupCode === '000000' ? '111111' : '000000' },
  });
  check('a wrong pickup code is refused', !badPickup.ok, badPickup.ok ? r('ACCEPTED') : dim(`${badPickup.status}`));

  const goodPickup = await api(`/deliveries/${deliveryId}/verify-pickup`, {
    method: 'POST',
    token: tokens.driver,
    body: { code: pickupCode },
  });
  check('the right pickup code is accepted', goodPickup.ok, goodPickup.ok ? dim('in transit') : `${goodPickup.status} ${goodPickup.body?.error ?? ''}`);
}

// ── 5. The handover — the test the payout model rests on ────────────────────

console.log(bold('\n5 · Handover'));
const recipientList = await api('/deliveries/mine', { token: tokens.recipient });
const mine = (recipientList.body?.data ?? []).find((d) => d.id === deliveryId);
const deliveryCode = mine?.deliveryCode;
check('recipient can read the delivery code', !!deliveryCode, deliveryCode ? '' : 'not returned to the recipient');

const wrong = await api(`/deliveries/${deliveryId}/verify-delivery`, {
  method: 'POST',
  token: tokens.driver,
  body: { code: deliveryCode === '000000' ? '111111' : '000000' },
});
check('a wrong delivery code is refused', !wrong.ok, wrong.ok ? r('ACCEPTED') : dim(`${wrong.status}`));

// And — the part that actually matters — no money moved because of it.
const afterWrong = await api(`/deliveries/${deliveryId}`, { token: tokens.sender });
check(
  'no money moves on a refused code',
  afterWrong.body?.data?.paymentStatus === 'authorised' && !afterWrong.body?.data?.stripeTransferId,
  afterWrong.body?.data?.stripeTransferId ? r('a transfer exists after a WRONG code') : dim('still authorised, no transfer'),
);

const right = await api(`/deliveries/${deliveryId}/verify-delivery`, {
  method: 'POST',
  token: tokens.driver,
  body: { code: deliveryCode },
});
check('the right delivery code is accepted', right.ok, right.ok ? '' : `${right.status} ${right.body?.error ?? ''}`);

// ── 6. The money actually moved ─────────────────────────────────────────────

console.log(bold('\n6 · Payout'));
const final = await waitFor('capture', tokens.sender, deliveryId, (d) => d.paymentStatus === 'captured', 20000);

check(
  'delivery is captured',
  final?.paymentStatus === 'captured',
  final?.paymentStatus === 'captured' ? '' : `still "${final?.paymentStatus}" — the transfer failed; see npm run payout:retry`,
);
check(
  'the split is correct',
  final?.platformFeeCHF === EXPECTED_FEE && final?.driverPayoutCHF === EXPECTED_PAYOUT,
  `fee ${final?.platformFeeCHF} / driver ${final?.driverPayoutCHF} (expected ${EXPECTED_FEE} / ${EXPECTED_PAYOUT})`,
);

const transferId = final?.stripeTransferId;
check(
  'a real transfer exists',
  !!transferId,
  transferId ? dim(transferId) : r('captured with NO transfer id — the driver has not been paid'),
);

if (transferId) {
  // Trust Stripe, not our own row. The two disagreeing is the whole point of
  // checking both.
  const tr = stripe('GET', `/transfers/${transferId}`);
  check(
    'Stripe agrees the transfer exists, for the right amount',
    tr.ok && tr.data?.amount === Math.round(EXPECTED_PAYOUT * 100),
    tr.ok ? dim(`${tr.data.amount} ${tr.data.currency}`) : tr.error.message.slice(0, 80),
  );
  check(
    'the transfer is tied to the funding charge',
    tr.ok && !!tr.data?.source_transaction,
    tr.ok && tr.data?.source_transaction
      ? dim(tr.data.source_transaction)
      : 'no source_transaction — it will fail whenever the platform balance is empty',
  );
}

// ── 7. Cancellation refunds the sender ──────────────────────────────────────

console.log(bold('\n7 · Cancellation and refund'));
const second = await api('/deliveries', {
  method: 'POST',
  token: tokens.sender,
  body: {
    pickupAddress: { label: 'Pfungen', point: PFUNGEN },
    deliveryAddress: { label: 'Schaffhausen', point: SCHAFFHAUSEN },
    recipientEmail: USERS.recipient,
    packageSize: 'S',
    packageDescription: `e2e refund ${new Date().toISOString()}`,
    budgetCHF: BUDGET,
    deliveryWindowStart: new Date(now + 24 * 3600 * 1000).toISOString(),
    deliveryWindowEnd: new Date(now + 48 * 3600 * 1000).toISOString(),
  },
});
const refundId = second.body?.data?.id;
const refundSecret = second.body?.data?.clientSecret;

if (refundId && refundSecret) {
  stripe('POST', `/payment_intents/${refundSecret.split('_secret_')[0]}/confirm`, {
    payment_method: 'pm_card_visa',
    return_url: 'https://shlep.ch/payout-return.html',
  });
  await waitFor('the webhook', tokens.sender, refundId, (d) => d.paymentStatus === 'authorised');

  const cancelled = await api(`/deliveries/${refundId}/status`, {
    method: 'PATCH',
    token: tokens.sender,
    body: { status: 'cancelled', cancelReason: 'e2e' },
  });
  check('a paid delivery can be cancelled', cancelled.ok, cancelled.ok ? '' : `${cancelled.status} ${cancelled.body?.error ?? ''}`);

  const refunded = await waitFor('refund', tokens.sender, refundId, (d) => d.paymentStatus === 'refunded', 20000);
  check(
    'the sender is refunded in full',
    refunded?.paymentStatus === 'refunded' && Math.abs((refunded?.refundedCHF ?? 0) - BUDGET) < 0.005,
    `${refunded?.paymentStatus} · ${refunded?.refundedCHF ?? 0} of ${BUDGET}`,
  );
} else {
  check('second delivery for the refund case', false, 'could not create it');
}

// ── Result ──────────────────────────────────────────────────────────────────

console.log(dim('\n' + '─'.repeat(74)));
console.log(
  `\n  ${g(`${passed} passed`)}   ${failures.length ? r(`${failures.length} failed`) : dim('0 failed')}` +
    `   ${blocked.length ? y(`${blocked.length} blocked`) : dim('0 blocked')}`,
);

writeReport(failures.length ? 'fail' : 'pass');
console.log(dim(`\n  Full report: .reports/e2e.json`));

if (failures.length) {
  console.log(r('\n  Failing:'));
  for (const f of failures) console.log(r(`    · ${f}`));
  console.log(
    dim(
      '\n  Not covered here, and still worth a look on a device: the payment\n' +
        '  sheet rendering, TWINT specifically, and anything in live mode.\n',
    ),
  );
  process.exit(1);
}

console.log(
  g('\n  A delivery was paid for, carried, refused on a wrong code, released on\n') +
    g('  the right one, and the driver was paid — without anyone touching a phone.\n'),
);
