import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PublishRouteScreen } from '../screens/driver/PublishRouteScreen';
import { AvailableDeliveriesScreen } from '../screens/driver/AvailableDeliveriesScreen';
import { MyRoutesScreen } from '../screens/driver/MyRoutesScreen';
import { ActiveDeliveryScreen } from '../screens/driver/ActiveDeliveryScreen';
import { OnboardingScreen } from '../screens/driver/OnboardingScreen';
import { EarningsScreen } from '../screens/driver/EarningsScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function DriverStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="MyRoutes" component={MyRoutesScreen} options={{ title: 'My Routes' }} />
      <Stack.Screen name="PublishRoute" component={PublishRouteScreen} options={{ title: 'Publish Route' }} />
      <Stack.Screen name="AvailableDeliveries" component={AvailableDeliveriesScreen} options={{ title: 'Available Deliveries' }} />
      <Stack.Screen name="ActiveDeliveries" component={ActiveDeliveryScreen} options={{ title: 'My Deliveries' }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Earnings' }} />
      <Stack.Screen name="PayoutOnboarding" component={OnboardingScreen} options={{ title: 'Payout setup' }} />
    </Stack.Navigator>
  );
}
