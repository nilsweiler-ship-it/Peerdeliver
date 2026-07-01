import { Request, Response, NextFunction } from 'express';
import { paymentService, deliveryService } from '../services';
import { success, error } from '../utils';
import { env } from '../config';

/** SIM mode: sender confirms a simulated TWINT payment. */
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

export async function startConnectOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshUrl, returnUrl } = req.body as { refreshUrl?: string; returnUrl?: string };
    const url = await paymentService.createOnboardingLink(
      req.user!.userId,
      refreshUrl || 'peerdeliver://payouts/refresh',
      returnUrl || 'peerdeliver://payouts/return',
    );
    success(res, { url });
  } catch (err) {
    next(err);
  }
}

export async function getConnectStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await paymentService.refreshConnectStatus(req.user!.userId);
    success(res, status);
  } catch (err) {
    next(err);
  }
}

export async function devCompleteOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    if (env.NODE_ENV !== 'development') {
      error(res, 'Not found', 404);
      return;
    }
    const data = await paymentService.devCompleteDriverOnboarding(req.user!.userId);
    success(res, data);
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
