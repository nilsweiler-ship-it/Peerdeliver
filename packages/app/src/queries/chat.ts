import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Conversation, Message, ApiResponse } from '@peerdeliver/shared';

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Conversation[]>>('/chat/conversations');
      return data.data!;
    },
  });
}

export function useMessages(deliveryId: string) {
  return useQuery({
    queryKey: ['chat', 'messages', deliveryId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Message[]>>(`/chat/${deliveryId}/messages`);
      return data.data!;
    },
    enabled: !!deliveryId,
  });
}

export function useSendMessage(deliveryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post<ApiResponse<Message>>(`/chat/${deliveryId}/messages`, {
        content,
      });
      return data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', deliveryId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

export function useMarkRead(deliveryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post(`/chat/${deliveryId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}
