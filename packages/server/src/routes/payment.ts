import { Router } from 'express';
import * as paymentController from '../controllers/payment';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
// Sender confirms a simulated TWINT payment for a delivery.
router.post('/twint/pay', paymentController.payWithTwint);
router.get('/earnings', paymentController.getEarnings);

export default router;
