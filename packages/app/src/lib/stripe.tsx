/**
 * Stripe surface for native.
 *
 * `@stripe/stripe-react-native` is a NATIVE module that Expo Go does not bundle.
 * So we only load the real package in a proper dev/standalone build; in Expo Go
 * (and whenever the native module is unavailable) we fall back to a passthrough
 * provider + no-op sheet, which is fine because that's the SIMULATED-TWINT path.
 * Real Stripe TWINT requires a dev build anyway.
 */
import React from 'react';
import Constants from 'expo-constants';

type AnyProps = { children: React.ReactNode; [key: string]: any };

function PassthroughProvider({ children }: AnyProps) {
  return <>{children}</>;
}
function useStripeStub() {
  const err = { error: { code: 'Failed', message: 'Payments need a dev build (not available in Expo Go).' } };
  return {
    initPaymentSheet: async () => err,
    presentPaymentSheet: async () => err,
  };
}

let StripeProvider: (props: AnyProps) => JSX.Element = PassthroughProvider;
let useStripe: () => { initPaymentSheet: Function; presentPaymentSheet: Function } = useStripeStub;

// appOwnership === 'expo' means we're inside Expo Go (no custom native modules).
const inExpoGo = Constants.appOwnership === 'expo';
if (!inExpoGo) {
  try {
    const rn = require('@stripe/stripe-react-native');
    if (rn?.StripeProvider) {
      StripeProvider = rn.StripeProvider;
      useStripe = rn.useStripe;
    }
  } catch {
    // Native module missing — keep the passthrough (simulated mode still works).
  }
}

export { StripeProvider, useStripe };
