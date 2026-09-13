/**
 * Stripe Connect end-to-end check, test mode only.
 *
 *   stripe login          # once — then no key handling at all
 *   npm run stripe:test
 *
 * or, if you prefer to supply a key yourself:
 *
 *   export STRIPE_SECRET_KEY=sk_test_...
 *   npm run stripe:test
 *
 * Runs the full money path once — connected account, payment, split, transfer —
 * and prints what each side receives. The point is to see a payout land before
 * a live key exists anywhere, because the first time this runs for real there
 * will be a driver waiting for money.
 *
 * Touches no database and calls no Shlep endpoint. It answers one question:
 * does the Stripe half work with this account's settings?
 *
 *
 * WHY IT TALKS TO THE CLI RATHER THAN HOLDING A KEY
 *
 * Getting a secret key from the dashboard into a shell variable turned out to
 * be the hardest part of this whole exercise — an ellipsis in documentation
 * that failed as a *network* error, a live key, a copy button that yields
 * nothing until "Reveal" is clicked, and a CLI that (in current versions)
 * stores its credentials in the macOS Keychain rather than in config.toml.
 *
 * `stripe login` already solved authentication. So when no key is supplied,
 * this delegates every request to `stripe get` / `stripe post`, which carry
 * their own auth. Nobody has to move a 107-character secret by hand.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.STRIPE_SECRET_KEY;
const AMOUNT_CHF = Number(process.env.TEST_AMOUNT_CHF || 69); // an XL delivery
const FEE_PCT = 9;
const FEE_MIN_CHF = 1.5;

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const chf = (n) => `CHF ${Number(n).toFixed(2)}`;

// ── Pick a transport ─────────────────────────────────────────────────────────

function cliAvailable() {
  try {
    execFileSync('stripe', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

let MODE;
if (KEY) {
  if (KEY.startsWith('sk_live_') || KEY.startsWith('rk_live_')) {
    console.error(r('Refusing to run: that is a LIVE key.'));
    console.error('  This script creates accounts, charges and transfers. Test mode only.');
    process.exit(1);
  }
  if (!/^[\x20-\x7E]+$/.test(KEY)) {
    console.error(r('Refusing to run: the key contains a non-ASCII character.'));
    console.error('  That is almost always a placeholder pasted from documentation, e.g. the "…" in sk_test_… .');
    process.exit(1);
  }
  if (!KEY.startsWith('sk_test_') && !KEY.startsWith('rk_test_')) {
    console.error(r(`Refusing to run: "${KEY.slice(0, 8)}" is not a test key prefix.`));
    console.error('  Expected sk_test_ or rk_test_. Or drop the variable entirely and use `stripe login`.');
    process.exit(1);
  }
  MODE = 'key';
} else if (cliAvailable()) {
  MODE = 'cli';
} else {
  console.error(r('No way to reach Stripe.'));
  console.error('\n  Easiest — let the Stripe CLI handle auth:');
  console.error('    brew install stripe/stripe-cli/stripe');
  console.error('    stripe login        # confirm the pairing code in the browser');
  console.error('    npm run stripe:test');
  console.error('\n  Or supply a test key yourself:');
  console.error('    export STRIPE_SECRET_KEY=sk_test_...');
  process.exit(1);
}

/**
 * Form-encode nested params the way Stripe expects:
 *   { capabilities: { transfers: { requested: true } } }
 *     → capabilities[transfers][requested]=true
 */
function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.push([key, String(v)]);
  }
  return out;
}

/** One request, whichever transport is in play. Throws an Error with .stripe set. */
async function req(method, path, params = {}, opts = {}) {
  const pairs = flatten(params);

  if (MODE === 'cli') {
    const args = [method.toLowerCase(), path];
    for (const [k, v] of pairs) args.push('-d', `${k}=${v}`);
    if (opts.stripeAccount) args.push('--stripe-account', opts.stripeAccount);
    // No idempotency key here: `stripe post` has no header flag. It costs
    // nothing — every run uses a fresh delivery id, so there is no repeat to
    // guard against. The server sets one on the calls that matter.
    try {
      const out = execFileSync('stripe', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const parsed = JSON.parse(out);
      // The CLI prints Stripe's error body and still exits 0, so a failed
      // request arrives here looking like a normal response. Without this the
      // script reported a transfer that never happened — the very failure mode
      // it exists to catch.
      if (parsed?.error) {
        const e = new Error(parsed.error.message ?? JSON.stringify(parsed.error));
        e.stripe = JSON.stringify(parsed.error);
        throw e;
      }
      return parsed;
    } catch (err) {
      if (err.stripe) throw err;
      const text = (err.stderr || err.stdout || err.message || '').toString().trim();
      const e = new Error(text.split('\n').slice(0, 4).join(' '));
      e.stripe = text;
      throw e;
    }
  }

  const headers = {
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (opts.stripeAccount) headers['Stripe-Account'] = opts.stripeAccount;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res;
  try {
    res = await fetch(`https://api.stripe.com${path}`, {
      method: method.toUpperCase(),
      headers,
      body: method.toLowerCase() === 'get' ? undefined : new URLSearchParams(pairs).toString(),
    });
  } catch (err) {
    const e = new Error(`could not reach api.stripe.com — ${err.message}`);
    e.network = true;
    throw e;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(body?.error?.message ?? `HTTP ${res.status}`);
    e.stripe = JSON.stringify(body?.error ?? body);
    throw e;
  }
  return body;
}

/** Mirrors computeSplit() in packages/server/src/services/payment.ts. */
function computeSplit(budgetCHF) {
  const raw = Math.max((budgetCHF * FEE_PCT) / 100, FEE_MIN_CHF);
  const platformFeeCHF = Math.min(Math.round(raw * 100) / 100, budgetCHF);
  return { platformFeeCHF, driverPayoutCHF: Math.round((budgetCHF - platformFeeCHF) * 100) / 100 };
}
const cents = (n) => Math.round(n * 100);

let step = 0;
const say = (msg) => console.log(`${g('✓')} ${String(++step).padStart(2)}. ${msg}`);
const warn = (msg) => console.log(`${r('!')}  ${String(++step).padStart(2)}. ${msg}`);
const fail = (msg, err) => {
  console.error(r(`\n✗ ${err?.network ? 'Could not reach Stripe' : msg}`));
  console.error(r(`  ${err?.message ?? err}`));
  if (err?.network) {
    console.error(dim('\n  Nothing about your Stripe account is implicated — the request never'));
    console.error(dim('  left this machine. Usual causes: no internet, a VPN, or TLS interception.\n'));
  }
  process.exit(1);
};

console.log(`\nStripe Connect — end-to-end test  ${dim('(test mode)')}`);
console.log(
  dim(MODE === 'cli' ? 'Using the Stripe CLI for auth — no key needed.\n' : 'Using STRIPE_SECRET_KEY.\n'),
);

// ── 1. Authentication ────────────────────────────────────────────────────────
try {
  await req('get', '/v1/balance');
  say('Authenticated with Stripe');
} catch (err) {
  fail('Could not authenticate.', err);
}

// ── 2. The driver's connected account ────────────────────────────────────────
//
// Reused across runs, deliberately. A fresh Express account cannot receive a
// transfer until someone completes Stripe's hosted onboarding, and only the
// account holder can do that. Creating a new account every run made that
// impossible to satisfy: you would onboard one account and the next run would
// create another. The id is cached beside the repo so the sequence works —
// run, onboard once, run again.
const ACCOUNT_CACHE = new URL('../.stripe-e2e-account', import.meta.url).pathname;

function cachedAccountId() {
  if (process.env.TEST_DRIVER_ACCOUNT) return process.env.TEST_DRIVER_ACCOUNT.trim();
  try {
    const id = readFileSync(ACCOUNT_CACHE, 'utf8').trim();
    return id.startsWith('acct_') ? id : null;
  } catch {
    return null;
  }
}

let account;
const reuseId = cachedAccountId();
if (reuseId) {
  try {
    account = await req('get', `/v1/accounts/${reuseId}`);
    say(`Reusing connected account  ${dim(account.id)}`);
  } catch {
    console.log(dim(`     Cached account ${reuseId} is gone; creating a new one.`));
  }
}
if (!account) {
  try {
    account = await req('post', '/v1/accounts', {
      type: 'express',
      country: 'CH',
      // Drivers are private individuals, not registered businesses — the exact
      // case that made Payrexx and Mangopay hard.
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      metadata: { userId: 'e2e-test-driver' },
    });
    try {
      writeFileSync(ACCOUNT_CACHE, account.id);
    } catch {
      /* cache is a convenience, not a requirement */
    }
    say(`Connected account created  ${dim(account.id)}`);
  } catch (err) {
    fail('Could not create a connected account. Is Connect enabled on this sandbox?', err);
  }
}

// ── 3. Onboarding link ───────────────────────────────────────────────────────
try {
  const link = await req('post', '/v1/account_links', {
    account: account.id,
    refresh_url: 'https://shlep.ch/driver/onboarding',
    return_url: 'https://shlep.ch/driver/onboarding/done',
    type: 'account_onboarding',
  });
  say('Onboarding link created');
  console.log(dim(`     ${String(link.url).slice(0, 92)}…`));
} catch (err) {
  fail('Could not create an onboarding link.', err);
}

// Two different permissions, routinely confused, and only one matters here.
//
//   capabilities.transfers  — may the platform move money TO this account?
//   payouts_enabled         — may this account withdraw to its own bank?
//
// A transfer needs the first. The second is the driver's business and only
// completes when they finish Stripe's hosted onboarding, which an Express
// account does itself — the platform cannot pre-fill those fields, which is
// why an earlier version of this script tried and got nowhere.
try {
  const fresh = await req('get', `/v1/accounts/${account.id}`);
  const transfersCap = fresh.capabilities?.transfers ?? 'unknown';
  if (transfersCap === 'active') {
    say(`Transfers capability active  ${dim('(payouts to their bank need onboarding)')}`);
  } else {
    warn(`Transfers capability is "${transfersCap}" — the transfer below will likely fail`);
    const due = fresh.requirements?.currently_due ?? [];
    if (due.length) console.log(dim(`     Driver must still provide: ${due.slice(0, 4).join(', ')}`));
    console.log(dim('     That is the hosted onboarding link from step 3, which only they can complete.'));
  }
} catch (err) {
  warn(`Could not read the account back: ${err.message}`);
}

// ── 4. The sender pays ───────────────────────────────────────────────────────
const { platformFeeCHF, driverPayoutCHF } = computeSplit(AMOUNT_CHF);
const deliveryId = `e2e-${Date.now()}`;
try {
  const intent = await req(
    'post',
    '/v1/payment_intents',
    {
      amount: cents(AMOUNT_CHF),
      currency: 'chf',
      // Card, not TWINT: TWINT needs the app to confirm and cannot run
      // headlessly. The money path being tested is identical either way.
      'payment_method_types[0]': 'card',
      payment_method: 'pm_card_visa',
      confirm: true,
      transfer_group: deliveryId,
      metadata: { deliveryRequestId: deliveryId },
    },
    { idempotencyKey: `e2e-intent-${deliveryId}` },
  );
  say(`Sender paid ${chf(AMOUNT_CHF)}  ${dim(intent.status)}`);
} catch (err) {
  fail('Payment failed.', err);
}

// ── 5. Delivery confirmed by code → transfer the driver's share ──────────────
console.log(dim(`\n     ${'─'.repeat(58)}`));
console.log(dim('     The delivery code has now been verified.'));
console.log(dim(`     Until this moment the full ${chf(AMOUNT_CHF)} sits in the platform balance —`));
console.log(dim('     the arrangement STRIPE_ACTIVATION.md section 0 is about.'));
console.log(dim(`     ${'─'.repeat(58)}\n`));

try {
  const transfer = await req(
    'post',
    '/v1/transfers',
    {
      amount: cents(driverPayoutCHF),
      currency: 'chf',
      destination: account.id,
      transfer_group: deliveryId,
      metadata: { deliveryRequestId: deliveryId },
    },
    { idempotencyKey: `e2e-transfer-${deliveryId}` },
  );
  // Insist on an id. A response without one is not a transfer, whatever the
  // HTTP status said.
  if (!transfer?.id) {
    throw new Error(`no transfer id returned — response was ${JSON.stringify(transfer).slice(0, 200)}`);
  }
  say(`Transferred ${chf(driverPayoutCHF)} to the driver  ${dim(transfer.id)}`);
} catch (err) {
  console.error(r(`\n✗ Transfer failed`));
  console.error(r(`  ${err.message}`));
  console.error(dim('\n  The payment succeeded, so charging works. Two usual causes:'));
  console.error(dim('   · the connected account has not finished onboarding, so its'));
  console.error(dim('     transfers capability is not active — open the link from step 3'));
  console.error(dim('     and complete it with Stripe\'s test data, then re-run;'));
  console.error(dim('   · the platform test balance is empty. Card payments settle after a'));
  console.error(dim('     short delay, so an immediate transfer can outrun the funds.\n'));
  process.exit(1);
}

// ── 6. What each side ends up with ───────────────────────────────────────────
console.log(`\n${dim('  Split')}`);
console.log(`  Sender pays          ${chf(AMOUNT_CHF)}`);
console.log(`  Driver receives      ${g(chf(driverPayoutCHF))}`);
console.log(`  Shlep keeps          ${chf(platformFeeCHF)}   ${dim(`(${FEE_PCT}%, min ${chf(FEE_MIN_CHF)})`)}`);

// The money actually arriving is the only evidence that counts. An earlier
// version printed "works end to end" while the driver's balance sat at zero.
let landed = null;
try {
  const bal = await req('get', '/v1/balance', {}, { stripeAccount: account.id });
  const buckets = [...(bal.pending ?? []), ...(bal.available ?? [])];
  landed = buckets.reduce((sum, b) => sum + (b.amount ?? 0), 0) / 100;
  console.log(`\n  Driver's Stripe balance  ${landed > 0 ? g(chf(landed)) : r(chf(landed))}`);
} catch (err) {
  console.log(dim(`\n  Could not read the driver's balance: ${err.message}`));
}

if (landed !== null && Math.abs(landed - driverPayoutCHF) < 0.01) {
  console.log(g('\n✓ The money path works end to end — the driver actually received it.\n'));
} else if (landed === 0) {
  console.log(r('\n✗ The transfer was accepted but nothing reached the driver.'));
  console.log(dim('  Almost always the connected account has not onboarded, so its transfers'));
  console.log(dim('  capability is inactive. Open the link from step 3, complete it with'));
  console.log(dim("  Stripe's test data, then run this again.\n"));
  process.exitCode = 1;
} else {
  console.log(
    dim(`\n  Balance is ${chf(landed ?? 0)}, expected ${chf(driverPayoutCHF)} — check the dashboard.\n`),
  );
  process.exitCode = 1;
}

console.log(dim('  Not proven here: TWINT specifically (needs the app to confirm),'));
console.log(dim('  webhook delivery, and the hold-until-delivery question in section 0.\n'));
