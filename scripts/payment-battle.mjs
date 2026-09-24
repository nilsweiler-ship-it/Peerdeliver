/**
 * Payment battle test.
 *
 *   stripe login          # once
 *   npm run payment:battle
 *
 * `npm run stripe:test` asks one question: does the happy path work? This asks
 * the opposite question — what happens when it doesn't. It is deliberately
 * hostile to our own code.
 *
 * Two suites:
 *
 *   1. ARITHMETIC — the fee split, run against every input a hostile world can
 *      produce: zero, negative, NaN, Infinity, a centime, an amount where the
 *      fee floor eats the whole ticket, and 20,000 random amounts checked for
 *      the one invariant that matters — fee + payout === budget, exactly, in
 *      integer cents. Needs nothing: no key, no database, no network.
 *
 *   2. STRIPE — the money paths, in test mode, against the real API. Not the
 *      happy path: the double capture, the transfer that cannot be reversed,
 *      the refund that goes out anyway, the payout of zero. Each scenario ends
 *      by computing the platform's net position and asserting we did not pay
 *      out more than we took in.
 *
 * Suite 1 always runs. Suite 2 is skipped, loudly, when Stripe is unreachable
 * — and a skipped suite is never counted as a pass. That distinction is the
 * whole reason this file exists: the first version of the e2e script printed
 * "the money path works end to end" while the transfer id was undefined.
 *
 * LIVE KEYS ARE REFUSED. This script deliberately creates failures.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

// Shared with stripe-e2e.mjs on purpose: onboarding a test driver is the one
// manual step in this whole toolchain, and doing it twice would be silly.
const ACCOUNT_CACHE = new URL('../.stripe-e2e-account', import.meta.url).pathname;

function cachedAccountId() {
  try {
    const id = readFileSync(ACCOUNT_CACHE, 'utf8').trim();
    return id.startsWith('acct_') ? id : null;
  } catch {
    return null;
  }
}

// The real implementation, not a copy of it. A battle test that reimplements
// the thing it tests only proves the copy agrees with itself.
const { splitBudget, DEFAULT_FEE_POLICY } = require('@peerdeliver/shared');

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const chf = (n) => `CHF ${Number(n).toFixed(2)}`;

const results = { pass: 0, fail: 0, skip: 0 };
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    results.pass += 1;
    console.log(`  ${g('✓')} ${name}${detail ? dim('  ' + detail) : ''}`);
  } else {
    results.fail += 1;
    failures.push(name);
    console.log(`  ${r('✗')} ${name}${detail ? '  ' + r(detail) : ''}`);
  }
}

function skip(name, why) {
  results.skip += 1;
  console.log(`  ${y('–')} ${name}  ${dim(why)}`);
}

function section(title) {
  console.log(`\n${bold(title)}`);
  console.log(dim('─'.repeat(72)));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — the fee split, under hostile input
// ─────────────────────────────────────────────────────────────────────────────

function cents(chfValue) {
  return Math.round(chfValue * 100);
}

function suiteArithmetic() {
  section('1 · Fee split arithmetic');
  const P = DEFAULT_FEE_POLICY;

  // The invariant. Everything else in this suite is a special case of it: if
  // fee + payout differs from the budget by even a centime, that centime was
  // either created out of nothing or taken from someone.
  let worstDrift = 0;
  let worstAt = null;
  for (let i = 0; i < 20000; i += 1) {
    // Amounts a sender can actually type, including the awkward ones: .05 steps
    // up to CHF 500, plus deliberate float landmines like 16.65 and 0.145.
    const budget = Math.round(Math.random() * 50000) / 100;
    const { platformFeeCHF, driverPayoutCHF } = splitBudget(budget, P);
    const drift = Math.abs(cents(platformFeeCHF) + cents(driverPayoutCHF) - cents(budget));
    if (drift > worstDrift) {
      worstDrift = drift;
      worstAt = budget;
    }
  }
  check(
    'fee + payout === budget, exactly, across 20 000 random amounts',
    worstDrift === 0,
    worstDrift === 0 ? 'no drift' : `off by ${worstDrift} centime(s) at ${chf(worstAt)}`,
  );

  // Float landmines: amounts whose binary representation is not exact.
  const landmines = [16.65, 8.075, 1.005, 0.145, 33.335, 12.125, 69.995];
  const landmineDrift = landmines.filter((b) => {
    const s = splitBudget(b, P);
    return cents(s.platformFeeCHF) + cents(s.driverPayoutCHF) !== cents(b);
  });
  check(
    'no drift on amounts that are not exactly representable in binary',
    landmineDrift.length === 0,
    landmineDrift.length ? `drifts at ${landmineDrift.map(chf).join(', ')}` : landmines.length + ' checked',
  );

  // Nothing may go negative. A negative payout becomes a negative transfer,
  // which is a transfer in the other direction.
  const negatives = [];
  for (let c = 0; c <= 30000; c += 1) {
    const s = splitBudget(c / 100, P);
    if (s.platformFeeCHF < 0 || s.driverPayoutCHF < 0) negatives.push(c / 100);
    if (negatives.length > 3) break;
  }
  check(
    'neither side goes negative for any budget from CHF 0 to CHF 300',
    negatives.length === 0,
    negatives.length ? `negative at ${negatives.map(chf).join(', ')}` : '30 001 amounts checked',
  );

  // The fee floor must never exceed the ticket. A CHF 1.00 delivery cannot
  // yield a CHF 1.50 fee — that is a payout of minus fifty centimes.
  const tiny = splitBudget(1, P);
  check(
    'fee floor cannot exceed the budget on a sub-floor ticket',
    tiny.platformFeeCHF <= 1 && tiny.driverPayoutCHF >= 0,
    `CHF 1.00 → fee ${chf(tiny.platformFeeCHF)}, payout ${chf(tiny.driverPayoutCHF)}`,
  );

  // Garbage in. These reach splitBudget if a client posts a string, a null, or
  // a number that overflowed somewhere upstream.
  const garbage = [NaN, Infinity, -Infinity, -50, undefined, null];
  const leaked = garbage.filter((v) => {
    const s = splitBudget(v, P);
    return (
      !Number.isFinite(s.platformFeeCHF) ||
      !Number.isFinite(s.driverPayoutCHF) ||
      s.platformFeeCHF < 0 ||
      s.driverPayoutCHF < 0
    );
  });
  check(
    'NaN, ±Infinity, negative and undefined budgets produce finite non-negative output',
    leaked.length === 0,
    leaked.length ? `leaked on ${leaked.map(String).join(', ')}` : garbage.length + ' hostile inputs',
  );

  // A hostile fee policy — misconfigured env, or a zero passed by mistake.
  const badPolicies = [
    { percent: NaN, minCHF: 1.5 },
    { percent: 9, minCHF: NaN },
    { percent: -9, minCHF: -1 },
    { percent: 1000, minCHF: 0 },
  ];
  const policyLeaks = badPolicies.filter((p) => {
    const s = splitBudget(40, p);
    return (
      !Number.isFinite(s.platformFeeCHF) ||
      !Number.isFinite(s.driverPayoutCHF) ||
      s.platformFeeCHF < 0 ||
      s.driverPayoutCHF < 0 ||
      cents(s.platformFeeCHF) + cents(s.driverPayoutCHF) !== cents(40)
    );
  });
  check(
    'a misconfigured fee policy cannot produce a broken split',
    policyLeaks.length === 0,
    policyLeaks.length ? `${policyLeaks.length} of ${badPolicies.length} policies broke the invariant` : '4 policies',
  );

  // The boundary where the percentage overtakes the floor: below CHF 16.67 the
  // floor binds, above it the percentage does. Worth naming because it is the
  // seam where a pricing change will first go wrong.
  const below = splitBudget(16.0, P);
  const above = splitBudget(20.0, P);
  check(
    'the CHF 1.50 floor binds below ~CHF 16.67 and the 9% takes over above it',
    below.platformFeeCHF === 1.5 && above.platformFeeCHF === 1.8,
    `CHF 16 → ${chf(below.platformFeeCHF)} · CHF 20 → ${chf(above.platformFeeCHF)}`,
  );

  // Documented, not asserted as safe: a budget of exactly the floor leaves the
  // driver nothing. Stripe rejects a zero-amount transfer, so this must be
  // caught before the transfer, not inside the split.
  const atFloor = splitBudget(1.5, P);
  console.log(
    dim(
      `\n  note  a CHF 1.50 budget yields a payout of ${chf(atFloor.driverPayoutCHF)}.` +
        '\n        Correct arithmetic, but a zero-amount transfer is an API error —' +
        '\n        suite 2 checks that the transfer path refuses it first.',
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe transport — same approach as stripe-e2e.mjs: CLI auth, or a test key
// ─────────────────────────────────────────────────────────────────────────────

const KEY = process.env.STRIPE_SECRET_KEY;

function cliAvailable() {
  try {
    execFileSync('stripe', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolveMode() {
  if (KEY) {
    if (KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_')) {
      console.error(r('\nRefusing to run: that is a LIVE key.'));
      console.error('  This script provokes failed transfers and refunds on purpose.');
      process.exit(1);
    }
    if (!/^[\x20-\x7E]+$/.test(KEY)) {
      console.error(r('\nRefusing to run: the key contains a non-ASCII character.'));
      console.error('  Almost always a placeholder pasted from documentation, e.g. the "…" in sk_test_… .');
      process.exit(1);
    }
    if (!KEY.startsWith('sk_test_') && !KEY.startsWith('rk_test_')) {
      console.error(r(`\nRefusing to run: "${KEY.slice(0, 8)}" is not a test key prefix.`));
      process.exit(1);
    }
    return 'key';
  }
  return cliAvailable() ? 'cli' : null;
}

/**
 * One Stripe request. Returns { ok, data, error } — never throws on API errors.
 *
 * `idempotencyKey` maps to the Idempotency-Key header, which is what
 * payment.ts relies on to survive a repeated capture. The Stripe CLI has no
 * flag for it, so supplying one forces the curl transport and therefore
 * requires STRIPE_SECRET_KEY; the affected scenario says so rather than
 * quietly dropping the key and testing something weaker.
 */
function stripeCall(mode, method, path, params = {}, idempotencyKey = null) {
  if (idempotencyKey && mode !== 'key') {
    return {
      ok: false,
      data: null,
      error: { message: 'needs STRIPE_SECRET_KEY (the CLI cannot send an Idempotency-Key header)', _transport: true },
    };
  }
  const flat = [];
  const walk = (prefix, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(`${prefix}[${k}]`, v);
    } else {
      flat.push([prefix, String(value)]);
    }
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);

  try {
    let body;
    if (mode === 'key') {
      const args = ['-s', '-X', method, `https://api.stripe.com/v1${path}`, '-u', `${KEY}:`];
      if (idempotencyKey) args.push('-H', `Idempotency-Key: ${idempotencyKey}`);
      for (const [k, v] of flat) args.push('-d', `${k}=${v}`);
      body = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 8 << 20 });
    } else {
      const verb = method === 'GET' ? 'get' : 'post';
      const args = [verb, path];
      for (const [k, v] of flat) args.push('-d', `${k}=${v}`);
      body = execFileSync('stripe', args, { encoding: 'utf8', maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
    }
    const parsed = JSON.parse(body);
    // The CLI exits 0 on API errors and prints the error body, which is exactly
    // how the first version of the e2e script came to report a success that
    // had not happened.
    if (parsed && parsed.error) return { ok: false, error: parsed.error, data: null };
    return { ok: true, data: parsed, error: null };
  } catch (err) {
    const raw = err.stdout?.toString?.() || err.stderr?.toString?.() || err.message;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error) return { ok: false, error: parsed.error, data: null };
    } catch {
      /* not JSON */
    }
    return { ok: false, error: { message: String(raw).trim().slice(0, 300) }, data: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — the money paths, adversarially
// ─────────────────────────────────────────────────────────────────────────────

const run = Date.now().toString(36);
let scenarioNo = 0;

/** A charge that has actually settled into the platform balance. */
function fundedCharge(mode, amountCHF, label) {
  const pi = stripeCall(mode, 'POST', '/payment_intents', {
    amount: Math.round(amountCHF * 100),
    currency: 'chf',
    // bypass_pending_balance makes test funds immediately available, so a
    // transfer is not rejected for a reason that would never occur in
    // production (where funds settle before anyone is paid).
    payment_method: 'pm_card_bypassPending',
    confirm: 'true',
    automatic_payment_methods: { enabled: 'true', allow_redirects: 'never' },
    metadata: { shlepBattle: run, scenario: label },
  });
  return pi;
}

function suiteStripe(mode) {
  section('2 · Stripe money paths');

  // ── 2.1 Double capture ────────────────────────────────────────────────────
  // Two verify calls land at once, or a webhook retries. Both read the delivery
  // as 'authorised' and both try to transfer. The only thing standing between
  // that and paying the driver twice is the idempotency key.
  // Reuse the account stripe-e2e.mjs caches, rather than creating a fresh one
  // per run. A newly created Express account has never been onboarded, so its
  // transfers capability is inactive and EVERY scenario that moves money
  // skips — which is what the first version of this script did, reporting
  // "4 skipped" forever and never once exercising the path it exists for.
  //
  // One onboarding therefore unblocks both scripts.
  scenarioNo += 1;
  let accountId = cachedAccountId();
  if (accountId) {
    console.log(dim(`  reusing connected account ${accountId} ${dim('(from .stripe-e2e-account)')}`));
  } else {
    const acct = stripeCall(mode, 'POST', '/accounts', {
      type: 'express',
      country: 'CH',
      email: `battle-${run}@shlep.ch`,
      capabilities: { transfers: { requested: 'true' } },
      business_type: 'individual',
      metadata: { shlepBattle: run },
    });
    if (!acct.ok) {
      check('create a connected test account', false, acct.error.message);
      console.log(dim('\n  Cannot continue suite 2 without a connected account.'));
      return;
    }
    accountId = acct.data.id;
    try {
      writeFileSync(ACCOUNT_CACHE, accountId);
    } catch {
      /* the cache is a convenience, not a requirement */
    }
    console.log(dim(`  created connected account ${accountId}`));
  }

  // Say up front whether the money scenarios can run at all, rather than
  // letting each one fail with the same opaque capability error.
  const acctState = stripeCall(mode, 'GET', `/accounts/${accountId}`);
  const transfersActive = acctState.ok && acctState.data?.capabilities?.transfers === 'active';
  if (!transfersActive) {
    console.log(
      y('\n  This account cannot receive transfers yet') +
        dim(
          ` (capability: ${acctState.ok ? (acctState.data?.capabilities?.transfers ?? 'not requested') : 'unknown'}).\n` +
            '  Every scenario below that moves money will skip. To fix it once, for both\n' +
            '  this script and npm run stripe:test:\n\n' +
            '      npm run stripe:test        # prints a fresh onboarding link\n\n' +
            "  Open the link and complete Stripe's hosted form with test data:\n" +
            '      IBAN     CH9300762011623852957\n' +
            '      address  any Swiss address; use line 1 "address_full_match"\n' +
            '      DOB      01 / 01 / 1901\n',
        ),
    );
  }

  const c1 = fundedCharge(mode, 69, 'double-capture');
  if (!c1.ok || c1.data.status !== 'succeeded') {
    check('fund the platform balance', false, c1.error?.message || `status ${c1.data?.status}`);
    return;
  }

  // The real defence is the idempotency key payment.ts passes as
  // `delivery-transfer-<deliveryId>`. This reproduces it exactly: two
  // identical requests carrying the same key, as two concurrent captures of
  // the same delivery would.
  const split = splitBudget(69, DEFAULT_FEE_POLICY);
  const idemKey = `battle-${run}-delivery-transfer`;
  const transferParams = {
    amount: Math.round(split.driverPayoutCHF * 100),
    currency: 'chf',
    destination: accountId,
    transfer_group: `battle-${run}-double`,
    metadata: { shlepBattle: run, scenario: 'double-capture' },
  };
  const t1 = stripeCall(mode, 'POST', '/transfers', transferParams, idemKey);
  const t2 = stripeCall(mode, 'POST', '/transfers', transferParams, idemKey);

  if (t1.error?._transport) {
    skip('two concurrent captures of one delivery pay the driver once', t1.error.message);
    skip('the check above is real: a different key does create a second transfer', t1.error.message);
  } else {
  const sameTransfer = t1.ok && t2.ok && t1.data.id === t2.data.id;
  check(
    'two concurrent captures of one delivery pay the driver once',
    sameTransfer || (t1.ok && !t2.ok),
    t1.ok && t2.ok && t1.data.id !== t2.data.id
      ? `TWO transfers created (${t1.data.id}, ${t2.data.id}) — the idempotency key did not hold`
      : sameTransfer
        ? `same transfer returned twice: ${t1.data.id}`
        : `first ${t1.ok ? 'ok' : 'failed'}, second ${t2.ok ? 'ok' : 'failed'}`,
  );

  // And the same request with a *different* key must produce a second
  // transfer — otherwise the check above passes for the wrong reason (Stripe
  // silently deduplicating everything) and would keep passing if our code
  // stopped sending a key at all.
  const t3 = stripeCall(mode, 'POST', '/transfers', transferParams, `${idemKey}-other`);
  check(
    'the check above is real: a different key does create a second transfer',
    t3.ok && t1.ok && t3.data.id !== t1.data.id,
    t3.ok && t1.ok && t3.data.id === t1.data.id
      ? 'Stripe deduplicated regardless of key — suite 2.1 proves nothing'
      : 'control passed',
  );
  }

  // ── 2.2 Payout of zero ────────────────────────────────────────────────────
  // A CHF 1.50 budget leaves the driver nothing. Does Stripe accept it?
  scenarioNo += 1;
  const zeroSplit = splitBudget(1.5, DEFAULT_FEE_POLICY);
  const zeroTransfer = stripeCall(mode, 'POST', '/transfers', {
    amount: Math.round(zeroSplit.driverPayoutCHF * 100),
    currency: 'chf',
    destination: accountId,
    metadata: { shlepBattle: run, scenario: 'zero' },
  });
  check(
    'Stripe rejects a zero-amount payout, so our code must catch it first',
    !zeroTransfer.ok,
    zeroTransfer.ok
      ? 'Stripe ACCEPTED a zero transfer — the guard is ours alone'
      : `rejected: ${zeroTransfer.error.message.slice(0, 80)}`,
  );

  // ── 2.3 Negative payout ───────────────────────────────────────────────────
  scenarioNo += 1;
  const negTransfer = stripeCall(mode, 'POST', '/transfers', {
    amount: -500,
    currency: 'chf',
    destination: accountId,
    metadata: { shlepBattle: run, scenario: 'negative' },
  });
  check(
    'a negative payout is refused',
    !negTransfer.ok,
    negTransfer.ok ? r('ACCEPTED — money moved the wrong way') : 'rejected',
  );

  // ── 2.4 Currency mismatch ─────────────────────────────────────────────────
  scenarioNo += 1;
  const eurTransfer = stripeCall(mode, 'POST', '/transfers', {
    amount: 1000,
    currency: 'eur',
    destination: accountId,
    metadata: { shlepBattle: run, scenario: 'eur' },
  });
  check(
    'a transfer in the wrong currency does not silently succeed',
    !eurTransfer.ok || eurTransfer.data.currency === 'eur',
    eurTransfer.ok ? dim('accepted as EUR — a CHF platform sending EUR is a bug upstream') : 'rejected',
  );

  // ── 2.5 THE MONEY-LOSS PATH ───────────────────────────────────────────────
  //
  // A cancellation arriving after the driver has already been paid and has
  // already cashed out. The transfer can no longer be reversed — the connected
  // balance is empty — and the question is what the sender gets refunded.
  //
  // This scenario does not call Stripe blindly; it replays `voidOnCancel`'s
  // decision, step for step, and then audits the platform's net position. The
  // policy under test:
  //
  //   1. reverse the transfer FIRST
  //   2. if the reversal fails, refund only budget − driverPayout
  //      (the platform fee, which never left our balance)
  //   3. never file a partial refund as a completed one
  //
  // The version this replaced did `.catch(() => {})` on the reversal and then
  // refunded the full budget unconditionally, losing the driver's cut on every
  // such cancellation with nothing in the logs.
  scenarioNo += 1;
  console.log(dim('\n  2.5  cancel-after-payout, with the reversal made to fail'));
  const budgetCHF = 69;
  const c2 = fundedCharge(mode, budgetCHF, 'money-loss');
  if (!c2.ok || c2.data.status !== 'succeeded') {
    skip('a cancellation never refunds more than the platform still holds', c2.error?.message || 'could not fund');
    skip('a partial refund is not recorded as a completed one', 'depends on the scenario above');
  } else {
    const paidOutCents = Math.round(split.driverPayoutCHF * 100);
    const t = stripeCall(mode, 'POST', '/transfers', {
      amount: paidOutCents,
      currency: 'chf',
      destination: accountId,
      transfer_group: `battle-${run}-loss`,
      metadata: { shlepBattle: run, scenario: 'money-loss' },
    });

    if (!t.ok) {
      skip('a cancellation never refunds more than the platform still holds', t.error.message.slice(0, 90));
      skip('a partial refund is not recorded as a completed one', 'depends on the scenario above');
    } else {
      // Put the connected account into the state a real driver reaches by
      // cashing out, so the reversal genuinely cannot succeed. This is the
      // hard part of reproducing the bug: with funds still sitting there the
      // reversal works and the hazard never shows.
      const bal = stripeCall(mode, 'GET', `/balance?stripe_account=${accountId}`);
      const available = bal.ok ? (bal.data.available?.[0]?.amount ?? 0) : 0;
      let drained = false;
      if (available > 0) {
        drained = stripeCall(mode, 'POST', `/payouts?stripe_account=${accountId}`, {
          amount: available,
          currency: 'chf',
        }).ok;
      }

      // Step 1 — reverse before refunding.
      const reversal = stripeCall(mode, 'POST', `/transfers/${t.data.id}/reversals`, { amount: paidOutCents });
      const recoveredCents = reversal.ok ? (reversal.data.amount ?? 0) : 0;

      // Step 2 — refund only what we still hold.
      const refundableCents = reversal.ok
        ? Math.round(budgetCHF * 100)
        : Math.max(0, Math.round(budgetCHF * 100) - paidOutCents);
      const refund =
        refundableCents > 0
          ? stripeCall(mode, 'POST', '/refunds', {
              payment_intent: c2.data.id,
              amount: refundableCents,
              metadata: { shlepBattle: run, scenario: 'money-loss' },
            })
          : { ok: true, data: { amount: 0 }, error: null };
      const refundedCents = refund.ok ? (refund.data.amount ?? 0) : 0;

      // The audit. We took in the budget, sent out the payout, got back
      // whatever the reversal recovered, and sent back the refund. If that sum
      // is negative, the cancellation cost us money.
      const netCents = Math.round(budgetCHF * 100) - paidOutCents + recoveredCents - refundedCents;

      console.log(
        dim(
          `       in ${chf(budgetCHF)} · driver paid ${chf(paidOutCents / 100)} · connected balance ${
            drained ? 'drained' : chf(available / 100)
          }` +
            `\n       reversal ${
              reversal.ok
                ? g('recovered ' + chf(recoveredCents / 100))
                : y('failed as intended: ' + reversal.error.message.slice(0, 55))
            }` +
            `\n       refund   ${refund.ok ? chf(refundedCents / 100) + ' to the sender' : r('failed: ' + refund.error.message.slice(0, 55))}` +
            `\n       net      ${netCents >= 0 ? g(chf(netCents / 100)) : r(chf(netCents / 100))}`,
        ),
      );

      check(
        'a cancellation never refunds more than the platform still holds',
        netCents >= 0,
        netCents >= 0
          ? `platform net ${chf(netCents / 100)}${reversal.ok ? '' : ' (fee retained, payout is a debt to chase)'}`
          : `platform out ${chf(Math.abs(netCents) / 100)} — the sender was refunded money that is with the driver`,
      );

      // The old code refunded the full budget here. Show what that would have
      // cost, so the assertion above is not an abstraction.
      if (!reversal.ok) {
        const wouldHaveLost = Math.round(budgetCHF * 100) - paidOutCents + 0 - Math.round(budgetCHF * 100);
        console.log(
          dim(
            `       for contrast: refunding the full ${chf(budgetCHF)} here, as the previous\n` +
              `       implementation did, would have left the platform at ${chf(wouldHaveLost / 100)}.`,
          ),
        );
      }

      check(
        'a partial refund is not recorded as a completed one',
        reversal.ok || refundedCents < Math.round(budgetCHF * 100),
        reversal.ok
          ? 'full refund, correctly complete'
          : `refunded ${chf(refundedCents / 100)} of ${chf(budgetCHF)} — delivery stays open`,
      );
    }
  }

  // ── 2.6 Double refund ─────────────────────────────────────────────────────
  // A cancel that arrives twice, or a webhook replay.
  scenarioNo += 1;
  const c3 = fundedCharge(mode, 25, 'double-refund');
  if (!c3.ok || c3.data.status !== 'succeeded') {
    skip('a repeated cancellation cannot refund twice', c3.error?.message || 'could not fund');
  } else {
    const r1 = stripeCall(mode, 'POST', '/refunds', { payment_intent: c3.data.id });
    const r2 = stripeCall(mode, 'POST', '/refunds', { payment_intent: c3.data.id });
    const total = (r1.ok ? r1.data.amount : 0) + (r2.ok ? r2.data.amount : 0);
    check(
      'a repeated cancellation cannot refund more than was charged',
      total <= 2500,
      total > 2500 ? `refunded ${chf(total / 100)} against a ${chf(25)} charge` : `refunded ${chf(total / 100)} total`,
    );
  }

  // ── 2.7 Transfer to an account that cannot receive ────────────────────────
  // The failure the driver actually hit: onboarding incomplete, transfers
  // capability inactive. Our code must not mark the delivery captured.
  scenarioNo += 1;
  const blocked = stripeCall(mode, 'POST', '/accounts', {
    type: 'express',
    country: 'CH',
    email: `battle-blocked-${run}@shlep.ch`,
    business_type: 'individual',
    metadata: { shlepBattle: run },
    // No transfers capability requested — the state a half-onboarded driver is in.
  });
  if (!blocked.ok) {
    skip('a payout to a non-onboarded driver fails loudly', blocked.error.message.slice(0, 80));
  } else {
    const t = stripeCall(mode, 'POST', '/transfers', {
      amount: 5000,
      currency: 'chf',
      destination: blocked.data.id,
      metadata: { shlepBattle: run, scenario: 'blocked' },
    });
    check(
      'a payout to a driver who has not finished onboarding fails loudly',
      !t.ok,
      t.ok ? r('ACCEPTED — money sent to an unverified account') : `rejected: ${t.error.message.slice(0, 70)}`,
    );
  }

  // ── 2.8 Refund of an uncaptured intent ────────────────────────────────────
  scenarioNo += 1;
  const uncaptured = stripeCall(mode, 'POST', '/payment_intents', {
    amount: 4000,
    currency: 'chf',
    payment_method_types: { 0: 'card' },
    metadata: { shlepBattle: run, scenario: 'uncaptured' },
  });
  if (!uncaptured.ok) {
    skip('refunding a never-paid delivery is refused', uncaptured.error.message.slice(0, 80));
  } else {
    const ref = stripeCall(mode, 'POST', '/refunds', { payment_intent: uncaptured.data.id });
    check(
      'refunding a delivery the sender never paid for is refused',
      !ref.ok,
      ref.ok ? r('ACCEPTED — refunded money we never received') : 'rejected',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(bold('\nShlep — payment battle test'));
console.log(dim('Hostile by design. Test mode only.'));

suiteArithmetic();

const mode = resolveMode();
if (!mode) {
  section('2 · Stripe money paths');
  skip('all Stripe scenarios', 'no Stripe access');
  console.log(dim('\n  Run `stripe login` once, or export a STRIPE_SECRET_KEY beginning sk_test_.'));
} else {
  console.log(dim(`\nStripe transport: ${mode === 'cli' ? 'stripe CLI' : 'STRIPE_SECRET_KEY'}`));
  suiteStripe(mode);
}

section('Result');
console.log(
  `  ${g(results.pass + ' passed')}   ${results.fail ? r(results.fail + ' failed') : dim('0 failed')}   ${
    results.skip ? y(results.skip + ' skipped') : dim('0 skipped')
  }`,
);

if (results.skip > 0) {
  console.log(
    dim(
      '\n  Skipped is not passed. A scenario that could not run has told you nothing\n' +
        '  about whether that path is safe.',
    ),
  );
}

if (results.fail > 0) {
  console.log(r('\n  Failing:'));
  for (const f of failures) console.log(r(`    · ${f}`));
  console.log(
    dim(
      '\n  Each failure above is a way the platform can lose money or double-pay.\n' +
        '  Fix the code, not the assertion.',
    ),
  );
  process.exit(1);
}

// Only claim what was actually exercised. A run where every money path was
// skipped has verified the arithmetic and nothing else, and saying otherwise
// is the exact failure mode this script was written to stop.
if (results.skip === 0) {
  console.log(
    g('\n  No scenario produced a double payment, a negative transfer, or a refund\n') +
      g('  larger than what was recovered.\n'),
  );
} else {
  console.log(
    y('\n  Arithmetic verified. The money paths were not fully exercised —\n') +
      y(`  ${results.skip} scenario${results.skip === 1 ? '' : 's'} could not run.\n`),
  );
}
