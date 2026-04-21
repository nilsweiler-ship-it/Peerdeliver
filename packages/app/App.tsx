import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryProvider } from './src/providers/QueryProvider';
import { SocketProvider } from './src/providers/SocketProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import './src/i18n';

const stripePublishableKey =
  (Constants.expoConfig?.extra?.stripePublishableKey as string | undefined) || '';

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripePublishableKey} merchantIdentifier="merchant.com.peerdeliver.app">
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
