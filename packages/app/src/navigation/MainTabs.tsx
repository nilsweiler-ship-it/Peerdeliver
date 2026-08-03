import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useMyDeliveries } from '../queries/delivery';
import { HomeScreen } from '../screens/shared/HomeScreen';
import { SenderStack } from './SenderStack';
import { DriverStack } from './DriverStack';
import { RecipientStack } from './RecipientStack';
import { ChatStack } from './ChatStack';
import { ProfileStack } from './ProfileStack';
import { colors, typography } from '../theme';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();

type FeatherName = keyof typeof Feather.glyphMap;

const icon = (name: FeatherName) =>
  ({ color, size }: { color: string; size: number }) => (
    <Feather name={name} size={size ?? 22} color={color} />
  );

export function MainTabs() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: deliveries } = useMyDeliveries();
  const hasIncoming = !!deliveries?.some((d) => d.recipientId && d.recipientId === userId);

  // Everyone can send and drive unless they have explicitly narrowed their
  // role. 'both' is the signup default: opting out is a deliberate choice, and
  // a sender who later wants to drive shouldn't have to find a settings screen
  // to discover the option exists.
  const showSender = role !== 'driver' && role !== 'recipient';
  const showDriver = role !== 'sender' && role !== 'recipient';
  // Receiving is not really a role — anyone can be named as the recipient of a
  // parcel. The tab appears when there is something to receive, rather than
  // sitting permanently empty for everyone.
  const showRecipient = role === 'recipient' || hasIncoming;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: typography.bodyStrong.fontFamily,
          fontSize: 11,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.home'), tabBarIcon: icon('home') }}
      />
      {showSender && (
        <Tab.Screen
          name="SenderStack"
          component={SenderStack}
          options={{ title: t('tabs.shipments'), tabBarIcon: icon('package') }}
        />
      )}
      {showDriver && (
        <Tab.Screen
          name="DriverStack"
          component={DriverStack}
          options={{ title: t('tabs.routes'), tabBarIcon: icon('navigation') }}
        />
      )}
      {showRecipient && (
        <Tab.Screen
          name="RecipientStack"
          component={RecipientStack}
          options={{ title: t('tabs.incoming'), tabBarIcon: icon('inbox') }}
        />
      )}
      <Tab.Screen
        name="ChatStack"
        component={ChatStack}
        options={{ title: t('tabs.chat'), headerShown: false, tabBarIcon: icon('message-circle') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: t('tabs.profile'), tabBarIcon: icon('user') }}
      />
    </Tab.Navigator>
  );
}
