import { Router } from 'express';
import { registerSchema, loginSchema, refreshTokenSchema } from '@peerdeliver/shared';
import * as authController from '../controllers/auth';
import { validate, authenticate, authLimiter } from '../middleware';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);

export default router;
