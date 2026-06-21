import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMessages, useSendMessage, useMarkRead } from '../../queries/chat';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { LoadingSpinner } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { BackChip } from '../../components/brand';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../providers/SocketProvider';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@peerdeliver/shared';

const QUICK_REPLIES = ['On my way 👋', 'Running late', 'Thanks!'];

/** Derive a short, stable display id (#PD-xxxxxx) from the delivery id. */
function shortRef(id: string): string {
  if (!id) return '------';
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return compact.slice(-6).padStart(6, '0');
}

export function ChatScreen({ route, navigation }: any) {
  const { deliveryId, otherName } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const socket = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const { data: messages, isLoading } = useMessages(deliveryId);
  const sendMessage = useSendMessage(deliveryId);
  const markRead = useMarkRead(deliveryId);

  const name = otherName || 'Chat';
  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  // Hide the default navigation header — we render a custom one.
  useEffect(() => {
    navigation.setOptions({ title: name, headerShown: false });
  }, [navigation, name]);

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
    },
    [sendMessage],
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

  // Day divider derived from the oldest message (list is inverted → footer).
  const firstMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const dayLabel = firstMessage
    ? new Date(firstMessage.createdAt).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Custom header bar */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <BackChip onPress={() => navigation.goBack()} />
        <Avatar firstName={firstName} lastName={lastName} size={40} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.headerStatus} numberOfLines={1}>
            <Text style={styles.onlineDot}>● </Text>
            Online · #PD-{shortRef(deliveryId)}
          </Text>
        </View>
        <TouchableOpacity style={styles.callButton} activeOpacity={0.8}>
          <Feather name="phone" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
                <View style={styles.typingBubble}>
                  <Text style={styles.typingText}>{t('chat.typing')}</Text>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            dayLabel ? (
              <View style={styles.dayDividerRow}>
                <View style={styles.dayDivider}>
                  <Text style={styles.dayDividerText}>{dayLabel}</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Quick replies */}
        <View style={styles.quickRow}>
          {QUICK_REPLIES.map((reply) => (
            <TouchableOpacity
              key={reply}
              style={styles.quickChip}
              activeOpacity={0.8}
              onPress={() => handleSend(reply)}
            >
              <Text style={styles.quickChipText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ChatInput onSend={handleSend} onTyping={handleTyping} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  headerStatus: {
    ...typography.overline,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
    marginTop: 1,
  },
  onlineDot: {
    color: colors.impact,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  dayDividerRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  dayDivider: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dayDividerText: {
    ...typography.overline,
    fontFamily: typography.figure.fontFamily,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    alignItems: 'flex-start',
  },
  typingBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typingText: {
    ...typography.caption,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  quickChipText: {
    ...typography.bodySmall,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
});
