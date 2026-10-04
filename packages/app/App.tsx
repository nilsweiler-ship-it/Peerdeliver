import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { StripeProvider } from './src/lib/stripe';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { QueryProvider } from './src/providers/QueryProvider';
import { SocketProvider } from './src/providers/SocketProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { api } from './src/services/api';
import './src/i18n';

/**
 * Take the Stripe publishable key from the server that holds the secret key.
 *
 * A PaymentIntent belongs to exactly one Stripe account. When the app carries
 * its own copy of the publishable key, nothing stops that copy coming from a
 * different account than the server's secret — and the result is
 * "The client_secret provided does not match any associated PaymentIntent on
 * this account", a message that names neither account and points at the
 * delivery rather than at the keys. That cost an afternoon here, with a
 * sandbox account on one side and the main account on the other.
 *
 * Fetching it from the API removes the possibility: both keys now come from
 * the same place. The bundled EXPO_PUBLIC_STRIPE_PK stays as a fallback for
 * when the API is unreachable at launch.
 */
function useStripeKey(): { key: string; ready: boolean } {
  const bundled = (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) || '';
  const [key, setKey] = useState(bundled);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = api.defaults.baseURL?.replace(/\/api$/, '') ?? '';
        const res = await fetch(`${base}/health/integrations`);
        const json = await res.json();
        const fromServer = json?.stripe?.publishableKey;
        if (!cancelled && typeof fromServer === 'string' && fromServer.startsWith('pk_')) {
          if (__DEV__ && bundled && bundled !== fromServer) {
            console.log('[stripe] using the server\'s publishable key; the bundled one differs');
          }
          setKey(fromServer);
        }
      } catch {
        // Offline at launch: keep the bundled key rather than blocking the app.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bundled]);

  return { key, ready };
}

export default function App() {
  const stripeKeyState = useStripeKey();
  // Two families, six faces. IBM Plex Sans is gone: Bricolage now carries
  // body text as well as display, which is four fewer font files to download
  // before the first screen can paint.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_700Bold,
  });

  // Proceed once fonts resolve — but never block the whole app on a font error
  // (e.g. on web a failed font fetch would otherwise hang on a blank screen).
  // Wait for both fonts and the key lookup. The key resolves in one request
  // and falls back immediately on failure, so this adds no meaningful delay —
  // but mounting StripeProvider with the wrong key and swapping it later does
  // not reinitialise the native SDK.
  if ((!fontsLoaded && !fontError) || !stripeKeyState.ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Empty key is fine: in simulated-TWINT mode Stripe is never called.
  const { key: stripeKey } = stripeKeyState;

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.ch.shlep.app">
        <QueryProvider>
          <SocketProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SocketProvider>
        </QueryProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
