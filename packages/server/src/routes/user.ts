import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as userController from '../controllers/user';
import * as verificationController from '../controllers/verification';
import { authenticate } from '../middleware';

const router = Router();

/**
 * Every SMS costs money and every send is a potential nuisance to whoever owns
 * the number, so cap how often one account can trigger one. Twilio applies its
 * own per-number limits; this stops one account spraying many numbers.
 */
const smsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Zu viele SMS-Anfragen. Bitte versuch es später nochmal.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.delete('/account', userController.deleteAccount);
router.post('/verification', verificationController.verify);
router.post('/verification/phone/start', smsLimiter, verificationController.startPhoneVerification);
router.post('/verification/phone/check', smsLimiter, verificationController.checkPhoneVerification);
router.post('/verification/dev-verify-all', verificationController.devVerifyAll);
router.post('/push-token', userController.registerPushToken);
router.delete('/push-token', userController.unregisterPushToken);

export default router;
