import { Router } from 'express';
import * as paymentController from '../controllers/payment';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
router.post('/connect/onboarding', paymentController.startConnectOnboarding);
router.get('/connect/status', paymentController.getConnectStatus);
router.get('/earnings', paymentController.getEarnings);
// Dev-only: skips the hosted Stripe Connect flow for the E2E test driver.
// The handler itself enforces NODE_ENV === 'development'.
router.post('/connect/dev-complete', paymentController.devCompleteOnboarding);

export default router;
