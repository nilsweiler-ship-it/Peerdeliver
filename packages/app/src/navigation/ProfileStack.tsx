import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { VerificationScreen } from '../screens/shared/VerificationScreen';
import { HelpSupportScreen } from '../screens/shared/HelpSupportScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { LegalDocScreen } from '../screens/legal/LegalDocScreen';

const Stack = createNativeStackNavigator();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LegalDoc" component={LegalDocScreen} />
    </Stack.Navigator>
  );
}
