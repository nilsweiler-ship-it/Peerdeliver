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
    if (opts.idempotencyKey) args.push('-H', `Idempotency-Key: ${opts.idempotencyKey}`);
    try {
      const out = execFileSync('stripe', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(out);
    } catch (err) {
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
let account;
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
  say(`Connected account created  ${dim(account.id)}`);
} catch (err) {
  fail('Could not create a connected account. Is Connect enabled on this sandbox?', err);
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

// A fresh Express account has not onboarded, so a transfer would be rejected.
// Fill in what Stripe's test mode accepts, then verify rather than assume.
try {
  await req('post', `/v1/accounts/${account.id}`, {
    business_profile: { url: 'https://shlep.ch', mcc: '4215' }, // courier services
    individual: {
      first_name: 'Dario',
      last_name: 'Driver',
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'address_full_match', city: 'Winterthur', postal_code: '8400', country: 'CH' },
      id_number: '000000000',
    },
    external_account: {
      object: 'bank_account',
      country: 'CH',
      currency: 'chf',
      account_number: 'CH9300762011623852957', // Stripe test IBAN
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
  });
  const fresh = await req('get', `/v1/accounts/${account.id}`);
  if (fresh.payouts_enabled) say('Account satisfies payout requirements');
  else {
    const due = fresh.requirements?.currently_due ?? [];
    warn(`Not payout-ready yet — still due: ${due.slice(0, 4).join(', ') || 'unknown'}`);
    console.log(dim('     The transfer below may fail. This is what a driver sees mid-onboarding.'));
  }
} catch (err) {
  warn(`Could not pre-fill the test account: ${err.message}`);
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
  say(`Transferred ${chf(driverPayoutCHF)} to the driver  ${dim(transfer.id)}`);
} catch (err) {
  fail('Transfer failed — usually the account is not payout-ready, or the test balance is empty.', err);
}

// ── 6. What each side ends up with ───────────────────────────────────────────
console.log(`\n${dim('  Split')}`);
console.log(`  Sender pays          ${chf(AMOUNT_CHF)}`);
console.log(`  Driver receives      ${g(chf(driverPayoutCHF))}`);
console.log(`  Shlep keeps          ${chf(platformFeeCHF)}   ${dim(`(${FEE_PCT}%, min ${chf(FEE_MIN_CHF)})`)}`);

try {
  const bal = await req('get', '/v1/balance', {}, { stripeAccount: account.id });
  const pending = (bal.pending ?? [])
    .map((b) => `${chf(b.amount / 100)} ${String(b.currency).toUpperCase()}`)
    .join(', ');
  console.log(`\n  Driver's Stripe balance (pending): ${pending || 'none yet'}`);
} catch {
  /* a nicety, not a result */
}

console.log(g('\n✓ The money path works end to end.\n'));
console.log(dim('  Not proven here: TWINT specifically (needs the app to confirm),'));
console.log(dim('  webhook delivery, and the hold-until-delivery question in section 0.\n'));
