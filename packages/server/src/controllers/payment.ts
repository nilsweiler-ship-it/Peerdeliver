import { Request, Response, NextFunction } from 'express';
import { paymentService, deliveryService } from '../services';
import { success } from '../utils';

export async function payWithTwint(req: Request, res: Response, next: NextFunction) {
  try {
    const { deliveryRequestId, phone } = req.body as { deliveryRequestId: string; phone?: string };
    await paymentService.payWithTwint(deliveryRequestId, req.user!.userId, phone);
    const delivery = await deliveryService.getDeliveryById(deliveryRequestId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function getEarnings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await paymentService.getEarnings(req.user!.userId);
    success(res, data);
  } catch (err) {
    next(err);
  }
}
