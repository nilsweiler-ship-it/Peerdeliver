import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config';
import { env } from '../config/env';
import { success, error } from '../utils';
import { payrexxService, paymentService } from '../services';

/**
 * Real TWINT payments via Payrexx.
 *
 * Flow: the app asks for a payment link, the sender completes TWINT on
 * Payrexx's hosted page, Payrexx calls our webhook, and only then does the
 * delivery move to paid. The redirect back into the app is cosmetic — it is
 * never treated as proof of payment.
 */

/** Start a TWINT payment for a delivery the caller owns. */
export async function createTwintPayment(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!payrexxService.isConfigured()) {
      error(res, 'TWINT payments are not configured', 503);
      return;
    }

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id: req.params.id },
      select: { id: true, senderId: true, budgetCHF: true, status: true },
    });
    if (!delivery) {
      error(res, 'Delivery not found', 404);
      return;
    }
    if (delivery.senderId !== req.user!.userId) {
      error(res, 'Not authorised', 403);
      return;
    }

    const base = env.PAYREXX_RETURN_BASE;
    const gateway = await payrexxService.createTwintGateway({
      deliveryId: delivery.id,
      amountCHF: Number(delivery.budgetCHF),
      purpose: `Shlep Lieferung ${delivery.id.slice(0, 8)}`,
      successUrl: `${base}/pay/success?d=${delivery.id}`,
      failedUrl: `${base}/pay/failed?d=${delivery.id}`,
      cancelUrl: `${base}/pay/cancelled?d=${delivery.id}`,
      language: (req.body?.language as string) ?? 'de',
      // Hold the funds; capture when the parcel is actually handed over.
      reserve: true,
    });

    await prisma.deliveryRequest.update({
      where: { id: delivery.id },
      data: { payrexxGatewayId: String(gateway.id) },
    });

    success(res, { link: gateway.link, gatewayId: gateway.id });
  } catch (err) {
    next(err);
  }
}

/**
 * Payrexx webhook.
 *
 * Mounted before the JSON body parser so the raw body is available for
 * signature checking. Two independent guards: the HMAC header, and re-reading
 * the gateway from the API. The second is what actually matters — Payrexx's
 * own docs say never to trust the notification alone.
 *
 * Always answers 200. A non-2xx triggers their retry schedule (10 attempts over
 * days), and retrying will not fix a delivery we cannot match.
 */
export async function webhook(req: Request, res: Response) {
  try {
    const raw = typeof req.body === 'string' ? req.body : (req.body as Buffer)?.toString('utf8');
    if (!raw) {
      res.status(200).json({ received: true });
      return;
    }

    const signatureOk = payrexxService.verifyWebhookSignature(
      raw,
      req.header('X-Webhook-Signature'),
    );

    const payload = JSON.parse(raw) as {
      transaction?: {
        id?: number;
        uuid?: string;
        status?: string;
        referenceId?: string;
        amount?: number;
      };
    };
    const tx = payload.transaction;
    if (!tx?.referenceId) {
      res.status(200).json({ received: true });
      return;
    }

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id: tx.referenceId },
      select: { id: true, payrexxGatewayId: true, budgetCHF: true, paymentStatus: true },
    });
    if (!delivery) {
      console.warn(`[payrexx:webhook] no delivery for reference ${tx.referenceId}`);
      res.status(200).json({ received: true });
      return;
    }

    // Confirm against the API rather than trusting the payload.
    let confirmed = false;
    if (delivery.payrexxGatewayId) {
      const gateway = await payrexxService.getGateway(Number(delivery.payrexxGatewayId));
      confirmed = gateway?.status === 'confirmed' || gateway?.status === 'reserved';
      if (gateway && Math.round(Number(delivery.budgetCHF) * 100) !== gateway.amount) {
        console.error(
          `[payrexx:webhook] amount mismatch for ${delivery.id}: expected ${delivery.budgetCHF} CHF, gateway ${gateway.amount} Rappen`,
        );
        res.status(200).json({ received: true });
        return;
      }
    }

    if (!signatureOk && !confirmed) {
      console.warn(`[payrexx:webhook] unverified and unconfirmed for ${delivery.id} — ignoring`);
      res.status(200).json({ received: true });
      return;
    }

    if (confirmed) {
      await paymentService.markDeliveryPaid(delivery.id, {
        provider: 'payrexx',
        transactionId: tx.id ? String(tx.id) : undefined,
      });
    } else if (tx.status && ['cancelled', 'declined', 'expired', 'error'].includes(tx.status)) {
      await paymentService.markDeliveryPaymentFailed(delivery.id, tx.status);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payrexx:webhook]', err instanceof Error ? err.message : err);
    res.status(200).json({ received: true });
  }
}
