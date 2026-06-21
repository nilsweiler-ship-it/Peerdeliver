import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useConversations } from '../../queries/chat';
import { Avatar, EmptyState, LoadingSpinner } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../providers/SocketProvider';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { Conversation } from '@peerdeliver/shared';
import { useQueryClient } from '@tanstack/react-query';

export function ChatListScreen({ navigation }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: conversations, isLoading, refetch, isRefetching } = useConversations();
  const socket = useSocket();
  const queryClient = useQueryClient();

  // Listen for new messages to refresh the list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    };

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE_NEW, handleNewMessage);
    };
  }, [socket, queryClient]);

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find((p) => p.id !== userId) || conversation.participants[0];
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const other = getOtherParticipant(item);
      const hasUnread = item.unreadCount > 0;

      return (
        <TouchableOpacity
          style={styles.conversationItem}
          onPress={() =>
            navigation.navigate('Chat', {
              deliveryId: item.deliveryRequestId,
              otherName: `${other.firstName} ${other.lastName}`,
            })
          }
          activeOpacity={0.7}
        >
          <Avatar
            firstName={other.firstName}
            lastName={other.lastName}
            uri={other.avatarUrl}
            size={48}
          />
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.name, hasUnread && styles.nameBold]} numberOfLines={1}>
                {other.firstName} {other.lastName}
              </Text>
              {item.lastMessage && (
                <Text style={styles.time}>{formatTime(item.lastMessage.createdAt)}</Text>
              )}
            </View>
            <View style={styles.conversationFooter}>
              <Text style={[styles.preview, hasUnread && styles.previewBold]} numberOfLines={1}>
                {item.lastMessage?.content || '...'}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [userId, navigation],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.sm }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="💬"
            title={t('chat.noConversations')}
            message={t('chat.noConversationsMessage')}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1 },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  nameBold: {
    color: colors.text,
  },
  time: {
    ...typography.overline,
    fontFamily: typography.figure.fontFamily,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  previewBold: {
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    ...typography.overline,
    fontFamily: typography.figure.fontFamily,
    color: colors.textInverse,
    fontSize: 11,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 76, // avatar width + padding
  },
});
