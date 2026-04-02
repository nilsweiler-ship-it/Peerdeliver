import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CreateRequestScreen } from '../screens/sender/CreateRequestScreen';
import { MyShipmentsScreen } from '../screens/sender/MyShipmentsScreen';
import { SearchDriversScreen } from '../screens/sender/SearchDriversScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function SenderStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="MyShipments" component={MyShipmentsScreen} options={{ title: 'My Shipments' }} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: 'New Request' }} />
      <Stack.Screen name="SearchDrivers" component={SearchDriversScreen} options={{ title: 'Find Drivers' }} />
    </Stack.Navigator>
  );
}
