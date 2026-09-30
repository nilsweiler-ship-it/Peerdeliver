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

/**
 * Public https pages Stripe sends the driver back to after onboarding.
 *
 * These used to default to `peerdeliver://payouts/return` — a custom app
 * scheme, and under the app's OLD name at that. Stripe rejects account links
 * whose refresh_url or return_url is not http(s), so `accountLinks.create`
 * threw every time and the app showed "Could not start payout setup. Please
 * try again." Trying again could not have helped; no driver could ever have
 * been onboarded from inside the app.
 *
 * The pages themselves just bounce back into the app via the shlep:// scheme,
 * which is the normal pattern for a native Connect onboarding return.
 */
const PAYOUT_BASE = (process.env.PAYOUT_RETURN_BASE || 'https://shlep.ch').replace(/\/$/, '');

export async function startConnectOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshUrl, returnUrl } = req.body as { refreshUrl?: string; returnUrl?: string };
    const isHttps = (u?: string) => !!u && /^https?:\/\//i.test(u);
    const url = await paymentService.createOnboardingLink(
      req.user!.userId,
      // Ignore a client-supplied value that Stripe would reject anyway, rather
      // than passing it through and failing with an opaque API error.
      isHttps(refreshUrl) ? refreshUrl! : `${PAYOUT_BASE}/payout-refresh.html`,
      isHttps(returnUrl) ? returnUrl! : `${PAYOUT_BASE}/payout-return.html`,
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
