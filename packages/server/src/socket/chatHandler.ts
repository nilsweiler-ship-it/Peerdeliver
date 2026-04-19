import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { chatService } from '../services';

export function setupChatHandlers(io: Server, socket: Socket) {
  socket.on(SOCKET_EVENTS.CHAT_JOIN, (deliveryRequestId: string) => {
    socket.join(`chat:${deliveryRequestId}`);
  });

  socket.on(SOCKET_EVENTS.CHAT_LEAVE, (deliveryRequestId: string) => {
    socket.leave(`chat:${deliveryRequestId}`);
  });

  socket.on(SOCKET_EVENTS.CHAT_TYPING, (deliveryRequestId: string) => {
    socket.to(`chat:${deliveryRequestId}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
      userId: socket.data.user.userId,
    });
  });

  socket.on(SOCKET_EVENTS.CHAT_READ, async (deliveryRequestId: string) => {
    try {
      await chatService.markMessagesAsRead(deliveryRequestId, socket.data.user.userId);
    } catch (err) {
      console.error('[Socket] Mark read error:', err);
    }
  });
}
