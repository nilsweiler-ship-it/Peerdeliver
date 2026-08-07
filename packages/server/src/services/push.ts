import { prisma } from '../config';

/**
 * Push notifications via Expo's push service.
 *
 * Same design rules as email.ts: fetch-based (no SDK), fire-and-forget, and it
 * never throws into a request path. A delivery handover must not fail because
 * a notification service is unreachable.
 *
 * No credentials are needed — Expo's push endpoint is open, and the token
 * itself is the addressing. Users without a token (permission not granted, or
 * running on web) are simply skipped.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  /** Delivered to the app so a tap can open the right screen. */
  data?: Record<string, unknown>;
}

/** Expo tokens look like ExponentPushToken[xxxxx] or ExpoPushToken[xxxxx]. */
export function isValidExpoToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send to many tokens at once. Expo accepts up to 100 messages per request.
 *
 * Tokens Expo reports as unregistered are cleared from the database — a stale
 * token is a device that uninstalled or reinstalled the app, and keeping it
 * means every future send carries a guaranteed failure.
 */
async function deliver(tokens: string[], message: PushMessage): Promise<void> {
  const valid = tokens.filter(isValidExpoToken);
  if (!valid.length) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        valid.map((to) => ({
          to,
          sound: 'default',
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          // Android needs a channel; the app creates "default" on registration.
          channelId: 'default',
        })),
      ),
    });

    if (!res.ok) {
      console.error(`[push:failed] ${res.status} ${(await res.text()).slice(0, 200)}`);
      return;
    }

    const body = (await res.json()) as { data?: ExpoTicket[] };
    const tickets = body.data ?? [];

    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.warn(`[push:ticket-error] ${ticket.message ?? ''} ${ticket.details?.error ?? ''}`);
        if (ticket.details?.error === 'DeviceNotRegistered') dead.push(valid[i]);
      }
    });

    if (dead.length) {
      await prisma.user
        .updateMany({ where: { expoPushToken: { in: dead } }, data: { expoPushToken: null } })
        .catch(() => undefined);
      console.log(`[push] cleared ${dead.length} unregistered token(s)`);
    }
  } catch (err) {
    console.error('[push:error]', err instanceof Error ? err.message : err);
  }
}

/**
 * Send to one user. Fire-and-forget by design — callers must not await this in
 * a request path, and it resolves even on failure.
 */
export function sendToUser(userId: string, message: PushMessage): void {
  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushToken: true },
      });
      if (!user?.expoPushToken) return;
      await deliver([user.expoPushToken], message);
    } catch (err) {
      console.error('[push:lookup]', err instanceof Error ? err.message : err);
    }
  })();
}

/** Store or replace a user's push token. */
export async function registerToken(userId: string, token: string): Promise<boolean> {
  if (!isValidExpoToken(token)) return false;
  // The same physical device can be re-used by a different account (shared
  // phone, or a test device). Detach the token from anyone else first,
  // otherwise two users would receive each other's notifications.
  await prisma.user.updateMany({
    where: { expoPushToken: token, NOT: { id: userId } },
    data: { expoPushToken: null },
  });
  await prisma.user.update({ where: { id: userId }, data: { expoPushToken: token } });
  return true;
}

/** Forget a token, e.g. on logout. */
export async function clearToken(userId: string): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { expoPushToken: null } })
    .catch(() => undefined);
}

// ── Lifecycle notifications ───────────────────────────────────────────────
// Copy is intentionally short: a notification is read on a lock screen, and
// the useful detail (codes, addresses) is in the app and the email.

export function notifyDeliveryMatched(senderId: string, driverName: string, deliveryId: string) {
  sendToUser(senderId, {
    title: 'Deine Lieferung hat eine fahrende Person',
    body: `${driverName} übernimmt deine Sendung.`,
    data: { type: 'delivery_matched', deliveryId },
  });
}

/** A sender picked this driver's route and is waiting on them. */
export function notifyDeliveryOffered(driverId: string, senderName: string, deliveryId: string) {
  sendToUser(driverId, {
    title: 'Anfrage für deine Route',
    body: `${senderName} möchte etwas auf deiner Route mitgeben.`,
    data: { type: 'delivery_offered', deliveryId },
  });
}

/** The offer was declined; the delivery is back in the open pool. */
export function notifyOfferDeclined(senderId: string, driverName: string, deliveryId: string) {
  sendToUser(senderId, {
    title: 'Anfrage abgelehnt',
    body: `${driverName} kann die Sendung nicht mitnehmen. Deine Lieferung ist wieder offen.`,
    data: { type: 'offer_declined', deliveryId },
  });
}

export function notifyPickedUp(senderId: string, deliveryId: string) {
  sendToUser(senderId, {
    title: 'Dein Paket ist unterwegs',
    body: 'Die Übergabe ist bestätigt — du kannst die Fahrt live verfolgen.',
    data: { type: 'picked_up', deliveryId },
  });
}

export function notifyDelivered(senderId: string, deliveryId: string) {
  sendToUser(senderId, {
    title: 'Zugestellt ✓',
    body: 'Dein Paket ist angekommen.',
    data: { type: 'delivered', deliveryId },
  });
}

export function notifyDriverPayout(driverId: string, payoutCHF: number, deliveryId: string) {
  sendToUser(driverId, {
    title: 'Deine Auszahlung ist unterwegs',
    body: `CHF ${payoutCHF.toFixed(2)} für deine Lieferung.`,
    data: { type: 'payout', deliveryId },
  });
}

export function notifyNewRequestOnRoute(driverId: string, route: string, priceCHF: number) {
  sendToUser(driverId, {
    title: 'Neue Anfrage auf deiner Strecke',
    body: `${route} · CHF ${priceCHF.toFixed(2)}`,
    data: { type: 'new_request' },
  });
}
