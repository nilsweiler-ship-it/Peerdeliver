import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { IncomingDeliveriesScreen } from '../screens/recipient/IncomingDeliveriesScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function RecipientStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen
        name="IncomingDeliveries"
        component={IncomingDeliveriesScreen}
        options={{ title: t('recipient.incomingDeliveries') }}
      />
    </Stack.Navigator>
  );
}
