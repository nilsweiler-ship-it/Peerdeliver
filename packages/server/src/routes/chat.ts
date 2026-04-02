import { Router } from 'express';
import * as chatController from '../controllers/chat';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
router.get('/conversations', chatController.getConversations);
router.get('/:deliveryId/messages', chatController.getMessages);
router.post('/:deliveryId/messages', chatController.sendMessage);
router.post('/:deliveryId/read', chatController.markRead);

export default router;
