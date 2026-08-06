import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { StripeProvider } from './src/lib/stripe';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { QueryProvider } from './src/providers/QueryProvider';
import { SocketProvider } from './src/providers/SocketProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import './src/i18n';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_700Bold,
  });

  // Proceed once fonts resolve — but never block the whole app on a font error
  // (e.g. on web a failed font fetch would otherwise hang on a blank screen).
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Empty key is fine: in simulated-TWINT mode Stripe is never called.
  const stripeKey = (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) || '';

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.com.peerdeliver.app">
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
