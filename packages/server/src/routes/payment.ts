import { Router } from 'express';
import * as paymentController from '../controllers/payment';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
// SIM mode: sender confirms a simulated TWINT payment for a delivery.
router.post('/twint/pay', paymentController.payWithTwint);
// REAL mode: driver payout onboarding (Stripe Connect).
router.post('/connect/onboarding', paymentController.startConnectOnboarding);
router.get('/connect/status', paymentController.getConnectStatus);
router.post('/connect/dev-complete', paymentController.devCompleteOnboarding);
router.get('/earnings', paymentController.getEarnings);

export default router;
