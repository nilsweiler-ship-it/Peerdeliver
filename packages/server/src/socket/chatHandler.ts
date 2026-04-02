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

  socket.on(
    SOCKET_EVENTS.CHAT_MESSAGE,
    async (data: { deliveryRequestId: string; content: string }) => {
      try {
        const message = await chatService.createMessage(
          data.deliveryRequestId,
          socket.data.user.userId,
          data.content,
        );
        io.to(`chat:${data.deliveryRequestId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE_NEW, message);
      } catch (err) {
        console.error('[Socket] Chat message error:', err);
      }
    },
  );

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
