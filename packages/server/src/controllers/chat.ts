import { Request, Response, NextFunction } from 'express';
import { chatService, deliveryService } from '../services';
import { success, error } from '../utils';
import { getIO } from '../socket';
import { SOCKET_EVENTS } from '@peerdeliver/shared';

/**
 * Every endpoint here is keyed on a delivery id supplied by the client, and
 * until now none of them checked whether the caller had anything to do with
 * that delivery. A chat thread carries a pickup address, a phone number and a
 * handover time, so an unguarded read is a meaningful privacy failure, not a
 * cosmetic one. Membership is verified server-side on each call, the same rule
 * the tracking socket already applied.
 */
async function denyIfNotParticipant(
  deliveryId: string,
  userId: string,
  res: Response,
): Promise<boolean> {
  if (await deliveryService.isDeliveryParticipant(deliveryId, userId)) return false;
  error(res, 'Not authorized', 403);
  return true;
}

export async function getMessages(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    if (await denyIfNotParticipant(req.params.deliveryId, req.user!.userId, res)) return;
    const messages = await chatService.getMessages(req.params.deliveryId);
    success(res, messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    if (await denyIfNotParticipant(req.params.deliveryId, req.user!.userId, res)) return;
    const message = await chatService.createMessage(
      req.params.deliveryId,
      req.user!.userId,
      req.body.content,
    );
    // Broadcast to other clients in the chat room via socket
    const io = getIO();
    if (io) {
      io.to(`chat:${req.params.deliveryId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE_NEW, message);
    }
    success(res, message, 201);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    if (await denyIfNotParticipant(req.params.deliveryId, req.user!.userId, res)) return;
    await chatService.markMessagesAsRead(req.params.deliveryId, req.user!.userId);
    success(res, { message: 'Messages marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    // Already scoped to the caller by the query itself.
    const conversations = await chatService.getConversations(req.user!.userId);
    success(res, conversations);
  } catch (err) {
    next(err);
  }
}
