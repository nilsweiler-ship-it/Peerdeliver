import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { ChatScreen } from '../screens/shared/ChatScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export function ChatStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Conversation' }} />
    </Stack.Navigator>
  );
}
