import { Router } from 'express';
import * as chatController from '../controllers/chat';
import { authenticate, validate } from '../middleware';
import { sendMessageSchema } from '@peerdeliver/shared';

const router = Router();

router.use(authenticate);
router.get('/conversations', chatController.getConversations);
router.get('/:deliveryId/messages', chatController.getMessages);
router.post('/:deliveryId/messages', validate(sendMessageSchema), chatController.sendMessage);
router.post('/:deliveryId/read', chatController.markRead);

export default router;
