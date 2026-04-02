import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services';
import { success } from '../utils';

export async function getMessages(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    const messages = await chatService.getMessages(req.params.deliveryId);
    success(res, messages);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    const message = await chatService.createMessage(
      req.params.deliveryId,
      req.user!.userId,
      req.body.content,
    );
    success(res, message, 201);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request<{ deliveryId: string }>, res: Response, next: NextFunction) {
  try {
    await chatService.markMessagesAsRead(req.params.deliveryId, req.user!.userId);
    success(res, { message: 'Messages marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await chatService.getConversations(req.user!.userId);
    success(res, conversations);
  } catch (err) {
    next(err);
  }
}
