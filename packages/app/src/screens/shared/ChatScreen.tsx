import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMessages, useSendMessage, useMarkRead } from '../../queries/chat';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { LoadingSpinner } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../providers/SocketProvider';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { colors, spacing, typography } from '../../theme';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@peerdeliver/shared';

export function ChatScreen({ route, navigation }: any) {
  const { deliveryId, otherName } = route.params;
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const { data: messages, isLoading } = useMessages(deliveryId);
  const sendMessage = useSendMessage(deliveryId);
  const markRead = useMarkRead(deliveryId);

  // Set header title
  useEffect(() => {
    navigation.setOptions({ title: otherName || 'Chat' });
  }, [navigation, otherName]);

  // Join chat room on mount
  useEffect(() => {
    if (!socket || !deliveryId) return;

    socket.emit(SOCKET_EVENTS.CHAT_JOIN, { deliveryRequestId: deliveryId });

    return () => {
      socket.emit(SOCKET_EVENTS.CHAT_LEAVE, { deliveryRequestId: deliveryId });
    };
  }, [socket, deliveryId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', deliveryId] });
      // Mark as read if message is from the other person
      if (message.senderId !== userId) {
        markRead.mutate();
      }
    };

    const handleTyping = (data: { userId: string }) => {
      if (data.userId !== userId) {
        setTypingUser(data.userId);
        // Clear typing indicator after 3 seconds
        setTimeout(() => setTypingUser(null), 3000);
      }
    };

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, handleTyping);

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, handleTyping);
    };
  }, [socket, deliveryId, userId, queryClient, markRead]);

  // Mark messages as read on mount
  useEffect(() => {
    if (messages && messages.length > 0) {
      markRead.mutate();
    }
  }, [messages?.length]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage.mutate(content);

      // Also emit via socket for real-time delivery
      if (socket) {
        socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
          deliveryRequestId: deliveryId,
          content,
        });
      }
    },
    [sendMessage, socket, deliveryId],
  );

  const handleTyping = useCallback(() => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING, { deliveryRequestId: deliveryId });
    }
  }, [socket, deliveryId]);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} isOwn={item.senderId === userId} />
    ),
    [userId],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={
          typingUser ? (
            <View style={styles.typingContainer}>
              <Text style={styles.typingText}>{t('chat.typing')}</Text>
            </View>
          ) : null
        }
      />
      <ChatInput onSend={handleSend} onTyping={handleTyping} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  typingText: {
    ...typography.caption,
    color: colors.textLight,
    fontStyle: 'italic',
  },
});
