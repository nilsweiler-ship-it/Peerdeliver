/**
 * Dynamic config layered over app.json.
 *
 * Exists for one reason: the Stripe publishable key has to differ between a
 * test build and a live one, and app.json is static. It sat as an empty string
 * there, which meant StripeProvider mounted with no key and initPaymentSheet
 * could never have succeeded — the real TWINT path had never been runnable.
 *
 * The publishable key is public by design (it identifies the account and can
 * only create, never read or move money), so committing a test key would be
 * harmless. It still comes from the environment, because the value that
 * matters is the live one and that should never be a thing someone edits a
 * tracked file to change.
 *
 *   EXPO_PUBLIC_STRIPE_PK=pk_test_...   # local dev + preview builds
 *   EXPO_PUBLIC_STRIPE_PK=pk_live_...   # production, set in EAS secrets
 *
 * Unset, the app falls back to simulated TWINT — no Stripe call is made, so an
 * empty key is correct rather than broken. What is NOT acceptable is an empty
 * key with a server in real mode: the server hands back a clientSecret the app
 * then cannot confirm. The check below makes that combination loud.
 */
const base = require('./app.json');

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PK || '';

if (stripePublishableKey && !/^pk_(test|live)_/.test(stripePublishableKey)) {
  throw new Error(
    `EXPO_PUBLIC_STRIPE_PK is set but does not look like a publishable key: "${stripePublishableKey.slice(0, 12)}…".\n` +
      'Expected pk_test_… or pk_live_…. A secret key (sk_…) must never be in the app bundle.',
  );
}

module.exports = ({ config }) => ({
  ...base.expo,
  ...config,
  extra: {
    ...base.expo.extra,
    stripePublishableKey,
  },
  plugins: [
    ...base.expo.plugins,
    // TWINT is a redirect method: the app hands off to the TWINT app and needs
    // a registered scheme to be handed back to. Without this plugin the native
    // SDK is present but the return leg is not configured, and a payment that
    // succeeds in TWINT never reports back.
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: 'merchant.ch.shlep.app',
        enableGooglePay: false,
      },
    ],
  ],
});
