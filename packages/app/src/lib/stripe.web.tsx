/**
 * Web stubs for Stripe. `@stripe/stripe-react-native` can't bundle for web, and
 * web uses the simulated TWINT flow anyway, so the provider just passes children
 * through and the payment sheet no-ops. Metro picks this file for web builds.
 */
import React from 'react';

export function StripeProvider({ children }: { children: React.ReactNode; [key: string]: any }) {
  return <>{children}</>;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: { code: 'Failed', message: 'Payments are not available on web.' } }),
    presentPaymentSheet: async () => ({ error: { code: 'Failed', message: 'Payments are not available on web.' } }),
  };
}
