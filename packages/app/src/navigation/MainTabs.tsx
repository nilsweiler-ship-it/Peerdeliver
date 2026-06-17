import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { HomeScreen } from '../screens/shared/HomeScreen';
import { SenderStack } from './SenderStack';
import { DriverStack } from './DriverStack';
import { RecipientStack } from './RecipientStack';
import { ChatStack } from './ChatStack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { colors } from '../theme';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);

  const showSender = role === 'sender' || role === 'both';
  const showDriver = role === 'driver' || role === 'both';
  const showRecipient = role === 'recipient';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      {showSender && (
        <Tab.Screen
          name="SenderStack"
          component={SenderStack}
          options={{ title: t('tabs.shipments') }}
        />
      )}
      {showDriver && (
        <Tab.Screen
          name="DriverStack"
          component={DriverStack}
          options={{ title: t('tabs.routes') }}
        />
      )}
      {showRecipient && (
        <Tab.Screen
          name="RecipientStack"
          component={RecipientStack}
          options={{ title: t('tabs.incoming') }}
        />
      )}
      <Tab.Screen
        name="ChatStack"
        component={ChatStack}
        options={{ title: t('tabs.chat'), headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}
