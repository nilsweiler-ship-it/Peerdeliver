import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { LoadingSpinner } from '../components/ui';
import { registerForPush } from '../services/pushNotifications';

export function RootNavigator() {
  const { isAuthenticated, isLoading, loadTokens } = useAuthStore();

  useEffect(() => {
    loadTokens();
  }, []);

  // Register for push only once signed in. Prompting before there is an account
  // asks permission for something the user cannot receive yet — and iOS allows
  // the prompt only once, so a decline at that point would be permanent.
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPush();
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
