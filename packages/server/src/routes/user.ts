import { Router } from 'express';
import * as userController from '../controllers/user';
import { authenticate } from '../middleware';

const router = Router();

router.use(authenticate);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.delete('/account', userController.deleteAccount);

export default router;
