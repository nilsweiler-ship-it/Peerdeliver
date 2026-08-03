import { Router } from 'express';
import * as paymentController from '../controllers/payment';
import * as payrexxController from '../controllers/payrexx';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
// SIM mode: sender confirms a simulated TWINT payment for a delivery.
router.post('/twint/pay', paymentController.payWithTwint);
// REAL mode: create a Payrexx hosted TWINT payment for a delivery.
router.post('/twint/:id/gateway', payrexxController.createTwintPayment);
// REAL mode: driver payout onboarding (Stripe Connect).
router.post('/connect/onboarding', paymentController.startConnectOnboarding);
router.get('/connect/status', paymentController.getConnectStatus);
router.post('/connect/dev-complete', paymentController.devCompleteOnboarding);
router.get('/earnings', paymentController.getEarnings);

export default router;
