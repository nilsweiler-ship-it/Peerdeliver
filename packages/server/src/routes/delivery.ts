import { Router } from 'express';
import { createDeliverySchema, updateDeliveryStatusSchema, verifyCodeSchema } from '@peerdeliver/shared';
import * as deliveryController from '../controllers/delivery';
import { authenticate, validate } from '../middleware';

const router = Router();

router.use(authenticate);
router.post('/', validate(createDeliverySchema), deliveryController.create);
router.get('/mine', deliveryController.getMine);
router.get('/nearby', deliveryController.getNearby);
router.get('/:id', deliveryController.getById);
router.patch('/:id/status', validate(updateDeliveryStatusSchema), deliveryController.updateStatus);
router.patch('/:id/assign', deliveryController.assign);
router.patch('/:id/confirm', deliveryController.confirm);
router.patch('/:id/reject', deliveryController.reject);
router.post('/:id/verify-pickup', validate(verifyCodeSchema), deliveryController.verifyPickup);
router.post('/:id/verify-delivery', validate(verifyCodeSchema), deliveryController.verifyDelivery);
router.get('/:id/driver', deliveryController.getDriverInfo);

export default router;
