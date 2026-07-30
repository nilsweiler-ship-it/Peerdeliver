import { Router } from 'express';
import authRoutes from './auth';
import deliveryRoutes from './delivery';
import routeRoutes from './route';
import userRoutes from './user';
import chatRoutes from './chat';
import paymentRoutes from './payment';
import partnerRoutes from './partner';
import formsRoutes from './forms';

const router = Router();

router.use('/auth', authRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/routes', routeRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/payments', paymentRoutes);
router.use('/partner', partnerRoutes);
router.use('/forms', formsRoutes);

export default router;
