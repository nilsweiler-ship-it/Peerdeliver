import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from './src/providers/QueryProvider';
import { SocketProvider } from './src/providers/SocketProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import './src/i18n';

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <SocketProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SocketProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
