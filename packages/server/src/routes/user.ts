import { Router } from 'express';
import * as userController from '../controllers/user';
import * as verificationController from '../controllers/verification';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.delete('/account', userController.deleteAccount);
router.post('/verification', verificationController.verify);
router.post('/verification/dev-verify-all', verificationController.devVerifyAll);

export default router;
