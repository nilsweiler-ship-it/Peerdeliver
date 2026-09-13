/**
 * Stripe Connect end-to-end check, test mode only.
 *
 *   export STRIPE_SECRET_KEY=sk_test_…
 *   node scripts/stripe-e2e.mjs
 *
 * Runs the full money path once — connected account, payment, split, transfer —
 * and prints what each side receives. The point is to see a payout land before
 * a live key exists anywhere, because the first time this runs for real there
 * will be a driver waiting for money.
 *
 * Touches no database and calls no Shlep endpoint. It answers one question:
 * does the Stripe half work with this account's settings?
 *
 * Refuses to run against a live key.
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
const AMOUNT_CHF = Number(process.env.TEST_AMOUNT_CHF || 69); // an XL delivery
const FEE_PCT = 9;
const FEE_MIN_CHF = 1.5;

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const chf = (n) => `CHF ${n.toFixed(2)}`;

if (!KEY) {
  console.error(r('STRIPE_SECRET_KEY is not set.'));
  console.error('  export STRIPE_SECRET_KEY=sk_test_…');
  process.exit(1);
}
if (!KEY.startsWith('sk_test_')) {
  console.error(r('Refusing to run: this is not a test key.'));
  console.error('  This script creates accounts, charges and transfers. Test mode only.');
  process.exit(1);
}

const stripe = new Stripe(KEY, { typescript: true });

/** Mirrors computeSplit() in packages/server/src/services/payment.ts. */
function computeSplit(budgetCHF) {
  const raw = Math.max((budgetCHF * FEE_PCT) / 100, FEE_MIN_CHF);
  const platformFeeCHF = Math.min(Math.round(raw * 100) / 100, budgetCHF);
  return {
    platformFeeCHF,
    driverPayoutCHF: Math.round((budgetCHF - platformFeeCHF) * 100) / 100,
  };
}
const cents = (chfAmount) => Math.round(chfAmount * 100);

let step = 0;
const say = (msg) => console.log(`${g('✓')} ${String(++step).padStart(2)}. ${msg}`);

/**
 * Report the failure that actually happened.
 *
 * An earlier version printed "Is Connect enabled?" for every error at this
 * step, including network failures — which sent the reader to the Stripe
 * dashboard to check a setting that was already correct. The SDK distinguishes
 * these clearly; the script should too.
 */
const fail = (msg, err) => {
  const type = err?.type ?? '';
  console.error(r(`\n✗ ${type === 'StripeConnectionError' ? 'Could not reach Stripe' : msg}`));
  console.error(r(`  ${err?.message ?? err}`));

  if (type === 'StripeConnectionError') {
    console.error(dim('\n  This never reached api.stripe.com — nothing about your Stripe'));
    console.error(dim('  account is implicated. Usual causes: no internet, a VPN or'));
    console.error(dim('  corporate proxy, or TLS interception.\n'));
    console.error('  Check the connection directly:');
    console.error(dim('    curl -sS -o /dev/null -w "%{http_code}\\n" https://api.stripe.com/v1/account \\'));
    console.error(dim('      -u "$STRIPE_SECRET_KEY:"'));
    console.error(dim('\n  401 means you reached Stripe and the key is wrong.'));
    console.error(dim('  200 means the key works and something in this process is blocked.'));
    console.error(dim('  A timeout or DNS error means the network is the problem.\n'));
  } else if (type === 'StripeAuthenticationError') {
    console.error(dim('\n  The key was rejected. Copy it again from Developers → API keys.\n'));
  } else if (type === 'StripePermissionError') {
    console.error(dim('\n  Reached Stripe, but this account may not have Connect enabled.'));
    console.error(dim('  Enable it at https://dashboard.stripe.com/connect/overview\n'));
  } else if (err?.raw?.doc_url) {
    console.error(dim(`  ${err.raw.doc_url}`));
  }
  process.exit(1);
};

console.log(`\nStripe Connect — end-to-end test  ${dim('(test mode)')}\n`);

// Fail fast and unambiguously if the network is the problem, rather than
// letting it surface as a confusing error three calls later.
try {
  await stripe.balance.retrieve();
  say('Reached Stripe and the key authenticates');
} catch (err) {
  fail('Could not authenticate with Stripe.', err);
}

// ── 1. The driver's connected account ────────────────────────────────────────
let account;
try {
  account = await stripe.accounts.create({
    type: 'express',
    country: 'CH',
    // Drivers are private individuals, not registered businesses. This is the
    // whole reason Payrexx and Mangopay were hard: most marketplace PSPs only
    // onboard companies.
    business_type: 'individual',
    capabilities: { transfers: { requested: true } },
    metadata: { userId: 'e2e-test-driver' },
  });
  say(`Connected account created  ${dim(account.id)}`);
} catch (err) {
  fail('Could not create a connected account. Is Connect enabled on this account?', err);
}

// ── 2. Onboarding link ───────────────────────────────────────────────────────
try {
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://shlep.ch/driver/onboarding',
    return_url: 'https://shlep.ch/driver/onboarding/done',
    type: 'account_onboarding',
  });
  say('Onboarding link created');
  console.log(dim(`     ${link.url.slice(0, 96)}…`));
} catch (err) {
  fail('Could not create an onboarding link.', err);
}

// In test mode a fresh Express account has not completed onboarding, so a real
// transfer to it would be rejected. Mark it ready the way Stripe's test helpers
// intend, then verify rather than assume.
try {
  await stripe.accounts.update(account.id, {
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
  const fresh = await stripe.accounts.retrieve(account.id);
  if (fresh.payouts_enabled) {
    say('Account satisfies payout requirements');
  } else {
    const due = fresh.requirements?.currently_due ?? [];
    console.log(
      `${r('!')}  ${String(++step).padStart(2)}. Account not payout-ready yet — still due: ${due.join(', ') || 'unknown'}`,
    );
    console.log(dim('     Transfers below may fail. This is what a real driver would see mid-onboarding.'));
  }
} catch (err) {
  console.log(`${r('!')}  ${String(++step).padStart(2)}. Could not pre-fill the test account: ${err.message}`);
}

// ── 3. The sender pays ───────────────────────────────────────────────────────
const { platformFeeCHF, driverPayoutCHF } = computeSplit(AMOUNT_CHF);
const deliveryId = `e2e-${Date.now()}`;
let intent;
try {
  intent = await stripe.paymentIntents.create(
    {
      amount: cents(AMOUNT_CHF),
      currency: 'chf',
      // Card, not TWINT: TWINT cannot be confirmed headlessly, it needs the
      // app. The money path being tested here is identical either way.
      payment_method_types: ['card'],
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

// ── 4. Delivery confirmed by code → transfer the driver's share ──────────────
console.log(dim(`\n     ${'─'.repeat(58)}`));
console.log(dim('     At this point the delivery code has been verified.'));
console.log(dim(`     Until now the full ${chf(AMOUNT_CHF)} sits in the platform balance —`));
console.log(dim('     which is the arrangement STRIPE_ACTIVATION.md section 0 is about.'));
console.log(dim(`     ${'─'.repeat(58)}\n`));

try {
  const transfer = await stripe.transfers.create(
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
  fail(
    'Transfer failed. Usually the connected account is not payout-ready, or the platform balance is empty in test mode.',
    err,
  );
}

// ── 5. What each side ends up with ───────────────────────────────────────────
console.log(`\n${dim('  Split')}`);
console.log(`  Sender pays          ${chf(AMOUNT_CHF)}`);
console.log(`  Driver receives      ${g(chf(driverPayoutCHF))}`);
console.log(`  Shlep keeps          ${chf(platformFeeCHF)}   ${dim(`(${FEE_PCT}%, min ${chf(FEE_MIN_CHF)})`)}`);

try {
  const bal = await stripe.balance.retrieve({ stripeAccount: account.id });
  const pending = (bal.pending ?? []).map((b) => `${chf(b.amount / 100)} ${b.currency.toUpperCase()}`).join(', ');
  console.log(`\n  Driver's Stripe balance (pending): ${pending || 'none yet'}`);
} catch {
  /* balance read is a nicety, not a result */
}

console.log(g('\n✓ The money path works end to end.\n'));
console.log(dim('  Not proven by this script: TWINT specifically (needs the app to confirm),'));
console.log(dim('  webhook delivery, and the hold-until-delivery question in section 0.\n'));
