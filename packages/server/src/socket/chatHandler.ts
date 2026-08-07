import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@peerdeliver/shared';
import { chatService, deliveryService } from '../services';

/**
 * Joining a chat room was previously unconditional: emit `chat:join` with any
 * delivery id and you were in the room, receiving every message broadcast for
 * that delivery. Membership is now checked before the join, mirroring the rule
 * the tracking handler already enforced for GPS.
 */
export function setupChatHandlers(io: Server, socket: Socket) {
  const userId = () => socket.data.user?.userId as string | undefined;

  socket.on(SOCKET_EVENTS.CHAT_JOIN, async (deliveryRequestId: string) => {
    try {
      const uid = userId();
      if (!uid || !(await deliveryService.isDeliveryParticipant(deliveryRequestId, uid))) return;
      socket.join(`chat:${deliveryRequestId}`);
    } catch (err) {
      console.error('[Socket] Chat join error:', err);
    }
  });

  socket.on(SOCKET_EVENTS.CHAT_LEAVE, (deliveryRequestId: string) => {
    socket.leave(`chat:${deliveryRequestId}`);
  });

  socket.on(SOCKET_EVENTS.CHAT_TYPING, (deliveryRequestId: string) => {
    // Only members are ever in the room, so membership is implied by presence.
    if (!socket.rooms.has(`chat:${deliveryRequestId}`)) return;
    socket.to(`chat:${deliveryRequestId}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
      userId: socket.data.user.userId,
    });
  });

  socket.on(SOCKET_EVENTS.CHAT_READ, async (deliveryRequestId: string) => {
    try {
      const uid = userId();
      if (!uid || !(await deliveryService.isDeliveryParticipant(deliveryRequestId, uid))) return;
      await chatService.markMessagesAsRead(deliveryRequestId, uid);
    } catch (err) {
      console.error('[Socket] Mark read error:', err);
    }
  });
}
