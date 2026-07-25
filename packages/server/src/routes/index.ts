import { Router } from 'express';
import authRoutes from './auth';
import deliveryRoutes from './delivery';
import routeRoutes from './route';
import userRoutes from './user';
import chatRoutes from './chat';
import paymentRoutes from './payment';
import partnerRoutes from './partner';

const router = Router();

router.use('/auth', authRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/routes', routeRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/payments', paymentRoutes);
router.use('/partner', partnerRoutes);

export default router;
