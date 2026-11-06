import { prisma } from '../config';
import { AppError } from '../middleware';
import * as paymentService from './payment';
import * as pushService from './push';
import * as emailService from './email';

/**
 * What happens to a delivery after the happy path stops: it runs out of time,
 * something goes wrong on the way, or it arrives and people rate each other.
 *
 * Before this file none of it existed. Nothing expired, so a request nobody
 * took stayed listed forever with the sender's money held; a parcel that never
 * arrived sat in 'in_transit' indefinitely; there was no way to report a
 * problem; and the ratings shown everywhere in the app could never change.
 */

// ── Expiry ────────────────────────────────────────────────────────────────

/** A matched driver who hasn't collected a day after the window has gone. */
const NO_SHOW_GRACE_HOURS = 24;
/** A parcel still not delivered two days after the window needs a person. */
const STUCK_GRACE_HOURS = 48;

export interface ExpiryResult {
  expired: string[];
  noShows: string[];
  stuck: string[];
}

/**
 * Close what time has overtaken. Safe to run on several instances at once:
 * each row is claimed by an UPDATE … RETURNING, so it is handled exactly once.
 */
export async function expireStale(): Promise<ExpiryResult> {
  // 0. Finish refunds a previous run started but didn't complete. The status
  //    flips first and the refund follows, so a Stripe error or a restart in
  //    between left a delivery expired (or cancelled) with the sender still
  //    charged — and nothing would ever look at it again.
  const unrefunded = await prisma.deliveryRequest.findMany({
    where: { status: { in: ['expired', 'cancelled'] }, paymentStatus: 'authorised', refundedAt: null },
    select: { id: true },
    take: 50,
  });
  for (const { id } of unrefunded) {
    try {
      await paymentService.voidOnCancel(id);
      console.log(`[expiry] ${id}: finished an interrupted refund`);
    } catch (err) {
      console.error(`[expiry] ${id}: refund retry failed — ${(err as Error).message}`);
    }
  }

  // 1. Nobody took it in time. The parcel never left the sender.
  const expired = await prisma.$queryRawUnsafe<{ id: string; senderId: string; driverId: string | null }[]>(
    `UPDATE delivery_requests
        SET status = 'expired'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE status IN ('pending'::"DeliveryStatus", 'requested'::"DeliveryStatus", 'offered'::"DeliveryStatus")
        AND "deliveryWindowEnd" < NOW()
      RETURNING id, "senderId", "driverId"`,
  );

  // 2. A driver was confirmed but never collected. The parcel is still with
  //    the sender, so this too simply ends and is refunded.
  const noShows = await prisma.$queryRawUnsafe<{ id: string; senderId: string; driverId: string | null }[]>(
    `UPDATE delivery_requests
        SET status = 'expired'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE status IN ('matched'::"DeliveryStatus", 'accepted'::"DeliveryStatus")
        AND "deliveryWindowEnd" < NOW() - INTERVAL '${NO_SHOW_GRACE_HOURS} hours'
      RETURNING id, "senderId", "driverId"`,
  );

  for (const row of [...expired, ...noShows]) {
    try {
      await paymentService.voidOnCancel(row.id);
    } catch (err) {
      console.error(`[expiry] ${row.id}: refund failed — ${(err as Error).message}`);
      emailService.sendInternal({
        subject: 'Refund failed on an expired delivery',
        lines: { delivery: row.id, error: (err as Error).message },
      });
    }
    pushService.sendToUser(row.senderId, {
      title: 'Lieferung abgelaufen',
      body: 'Für deine Sendung hat sich im Zeitfenster niemand gefunden. Der Betrag wird dir zurückerstattet.',
      data: { type: 'delivery_expired', deliveryId: row.id },
    });
  }
  // A driver who had asked for, or been offered, the job should hear it ended.
  for (const row of [...expired, ...noShows]) {
    if (row.driverId) {
      pushService.sendToUser(row.driverId, {
        title: 'Lieferung abgelaufen',
        body: 'Eine Lieferung, die du angefragt oder angenommen hattest, ist abgelaufen.',
        data: { type: 'delivery_expired', deliveryId: row.id },
      });
    }
  }
  for (const row of noShows) {
    if (row.driverId) {
      await prisma.message
        .create({
          data: {
            deliveryRequestId: row.id,
            senderId: row.driverId,
            content: 'This delivery expired: the parcel was not collected within a day of its window. The sender has been refunded.',
          },
        })
        .catch(() => {});
    }
  }

  // 3. Collected but never delivered. The parcel is with the driver; nobody
  //    can tell from here what happened. Hold the money and hand it to support.
  const stuck = await prisma.$queryRawUnsafe<{ id: string; senderId: string; driverId: string | null }[]>(
    `UPDATE delivery_requests
        SET status = 'disputed'::"DeliveryStatus",
            "disputeOpenedAt" = NOW(),
            "disputeReason" = 'Automatic: not delivered ${STUCK_GRACE_HOURS} h after the delivery window',
            "updatedAt" = NOW()
      WHERE status IN ('picked_up'::"DeliveryStatus", 'in_transit'::"DeliveryStatus")
        AND "deliveryWindowEnd" < NOW() - INTERVAL '${STUCK_GRACE_HOURS} hours'
      RETURNING id, "senderId", "driverId"`,
  );
  for (const row of stuck) {
    emailService.sendInternal({
      subject: 'Dispute opened automatically: parcel not delivered',
      lines: { delivery: row.id, sender: row.senderId, driver: row.driverId ?? '—', next: 'npm run dispute -- show ' + row.id },
    });
    pushService.sendToUser(row.senderId, {
      title: 'Wir kümmern uns darum',
      body: 'Deine Sendung ist noch nicht angekommen. Unser Support meldet sich bei dir; dein Geld bleibt bis dahin zurückgehalten.',
      data: { type: 'dispute_opened', deliveryId: row.id },
    });
  }

  const result = { expired: expired.map((r) => r.id), noShows: noShows.map((r) => r.id), stuck: stuck.map((r) => r.id) };
  if (expired.length || noShows.length || stuck.length) {
    console.log(`[expiry] expired ${expired.length}, no-shows ${noShows.length}, stuck → disputed ${stuck.length}`);
  }
  return result;
}

/** Run expireStale now and every `minutes` after. Never throws. */
export function startExpiryJob(minutes = 10): NodeJS.Timeout {
  const run = () =>
    expireStale().catch((err) => console.error('[expiry] run failed:', (err as Error).message));
  void run();
  return setInterval(run, minutes * 60_000);
}

// ── Disputes ──────────────────────────────────────────────────────────────

/** How long after delivery a problem can still be reported. */
const DISPUTE_WINDOW_DAYS = 14;

export interface Viewer {
  userId: string;
  email?: string | null;
}

function roleOf(
  d: { senderId: string; driverId: string | null; recipientId: string | null; recipientEmail: string | null },
  viewer: Viewer,
): 'sender' | 'driver' | 'recipient' | null {
  if (d.driverId === viewer.userId) return 'driver';
  if (d.senderId === viewer.userId) return 'sender';
  // Linked by account only. An email match is not proof of owning the
  // mailbox (emails aren't verified at sign-up), and it would let anyone who
  // knows the address freeze a delivery or rate its driver.
  if (d.recipientId === viewer.userId) return 'recipient';
  return null;
}

/**
 * Report a problem with a delivery.
 *
 * On the way (picked up / in transit): the delivery becomes 'disputed'. The
 * payment stays held — the driver cannot be paid out and the sender is not
 * refunded until support decides. The driver can still complete it with the
 * recipient's code, which settles the dispute by itself.
 *
 * Already delivered (within 14 days): the money has moved, so the status stays
 * 'delivered'; the dispute is recorded and support is told.
 */
export async function openDispute(deliveryId: string, viewer: Viewer, reason: string) {
  const text = (reason ?? '').trim();
  if (text.length < 10) throw new AppError(400, 'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen).');
  if (text.length > 1000) throw new AppError(400, 'Bitte fasse dich kürzer (höchstens 1000 Zeichen).');

  const d = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: {
      id: true, status: true, senderId: true, driverId: true, recipientId: true, recipientEmail: true,
      disputeOpenedAt: true, disputeResolvedAt: true, updatedAt: true, deliveredAt: true, budgetCHF: true,
    },
  });
  const role = d ? roleOf(d, viewer) : null;
  if (!d || !role) throw new AppError(404, 'Delivery not found');
  // One report per delivery. A second one goes to support by email: letting
  // open → resolve → open repeat meant a delivery could be re-disputed (and
  // re-refunded) for ever.
  if (d.disputeOpenedAt) {
    throw new AppError(
      409,
      d.disputeResolvedAt
        ? 'Zu dieser Lieferung gab es bereits eine Meldung. Bitte schreib uns an hello@shlep.ch.'
        : 'Zu dieser Lieferung ist bereits eine Meldung offen. Unser Support meldet sich.',
    );
  }

  if (d.status === 'picked_up' || d.status === 'in_transit') {
    const applied = await prisma.$executeRawUnsafe(
      `UPDATE delivery_requests
          SET status = 'disputed'::"DeliveryStatus", "disputeOpenedAt" = NOW(), "disputeOpenedById" = $2,
              "disputeReason" = $3, "disputeResolvedAt" = NULL, "disputeResolution" = NULL, "updatedAt" = NOW()
        WHERE id = $1 AND status = $4::"DeliveryStatus"`,
      deliveryId, viewer.userId, text, d.status,
    );
    if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');
  } else if (d.status === 'delivered') {
    const ageDays = (Date.now() - (d.deliveredAt ?? d.updatedAt).getTime()) / 86_400_000;
    if (ageDays > DISPUTE_WINDOW_DAYS) {
      throw new AppError(400, `Probleme können bis ${DISPUTE_WINDOW_DAYS} Tage nach der Zustellung gemeldet werden.`);
    }
    await prisma.deliveryRequest.update({
      where: { id: deliveryId },
      data: {
        disputeOpenedAt: new Date(), disputeOpenedById: viewer.userId, disputeReason: text,
        disputeResolvedAt: null, disputeResolution: null,
      },
    });
  } else {
    throw new AppError(
      400,
      'Vor der Abholung kannst du die Sendung einfach stornieren; danach hilft dir diese Meldung.',
    );
  }

  emailService.sendInternal({
    subject: `Dispute opened by the ${role}`,
    lines: {
      delivery: deliveryId, status: d.status, reportedBy: `${role} (${viewer.userId})`,
      amountCHF: d.budgetCHF, reason: text, next: `npm run dispute -- show ${deliveryId}`,
    },
  });
  if (d.driverId) {
    await prisma.message
      .create({
        data: {
          deliveryRequestId: deliveryId,
          senderId: viewer.userId,
          content: `A problem was reported (${role}): ${text}\nShlep support will get in touch.`,
        },
      })
      .catch(() => {});
  }
  for (const other of [d.senderId, d.driverId, d.recipientId]) {
    if (other && other !== viewer.userId) {
      pushService.sendToUser(other, {
        title: 'Problem gemeldet',
        body: 'Zu einer Lieferung wurde ein Problem gemeldet. Unser Support meldet sich.',
        data: { type: 'dispute_opened', deliveryId },
      });
    }
  }

  return prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, disputeOpenedAt: true, disputeReason: true },
  });
}

/**
 * Support settles a dispute. Not exposed over HTTP: run from scripts/dispute.ts
 * by a person who has looked at the case.
 *
 *   'deliver' — the parcel did arrive (or the driver is owed regardless): the
 *               delivery completes and the driver is paid.
 *   'refund'  — it didn't: the sender is refunded. If the driver was already
 *               paid (a dispute after delivery), the transfer is reversed
 *               first; voidOnCancel handles a reversal that fails.
 */
export async function resolveDispute(deliveryId: string, outcome: 'deliver' | 'refund', note: string) {
  const d = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: {
      status: true, disputeOpenedAt: true, disputeResolvedAt: true, paymentStatus: true,
      driverId: true, senderId: true, co2SavedKg: true,
    },
  });
  if (!d) throw new Error('Delivery not found');
  if (!d.disputeOpenedAt || d.disputeResolvedAt) throw new Error('No open dispute on this delivery');
  const resolution = `${outcome}: ${note || '(no note)'}`;

  if (d.status === 'disputed') {
    const next = outcome === 'deliver' ? 'delivered' : 'cancelled';
    const applied = await prisma.$executeRawUnsafe(
      `UPDATE delivery_requests
          SET status = $2::"DeliveryStatus", "disputeResolvedAt" = NOW(), "disputeResolution" = $3,
              "cancelReason" = CASE WHEN $2 = 'cancelled' THEN 'Dispute resolved: refund' ELSE "cancelReason" END,
              "updatedAt" = NOW()
        WHERE id = $1 AND status = 'disputed'::"DeliveryStatus"`,
      deliveryId, next, resolution,
    );
    if (applied === 0) throw new Error('Delivery changed while resolving; look again');
    if (outcome === 'deliver') await paymentService.captureAndPayoutOnDelivered(deliveryId);
    else await paymentService.voidOnCancel(deliveryId);
  } else if (d.status === 'delivered') {
    // Claim the resolution atomically so two support runs can't both act.
    const { count } = await prisma.deliveryRequest.updateMany({
      where: { id: deliveryId, disputeResolvedAt: null },
      data: { disputeResolvedAt: new Date(), disputeResolution: resolution },
    });
    if (count === 0) throw new Error('Resolved by someone else in the meantime');
    if (outcome === 'deliver') {
      // Delivered with the code while the dispute was open: the payout was
      // held. Release it now. (No-op if it was already captured.)
      await paymentService.captureAndPayoutOnDelivered(deliveryId);
    } else {
      await paymentService.voidOnCancel(deliveryId);
      // Not a completed delivery after all: take back what it credited.
      const co2 = d.co2SavedKg ?? 0;
      if (d.driverId) {
        await prisma.user.update({
          where: { id: d.driverId },
          data: { totalDeliveries: { decrement: 1 }, co2Saved: { decrement: co2 } },
        }).catch(() => {});
      }
      if (co2) {
        await prisma.user.update({ where: { id: d.senderId }, data: { co2Saved: { decrement: co2 } } }).catch(() => {});
      }
    }
  } else {
    throw new Error(`Unexpected status ${d.status} for an open dispute`);
  }

  return prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, paymentStatus: true, refundedCHF: true, driverPayoutCHF: true, disputeResolution: true },
  });
}

// ── Ratings ───────────────────────────────────────────────────────────────

/** How long after delivery a rating can still be left. */
const RATING_WINDOW_DAYS = 30;

/**
 * Rate the other side of a completed delivery: the sender rates the driver,
 * the driver rates the sender. Once each per delivery.
 * The rated person's average is recomputed from the ratings table in the same
 * transaction, so it can never drift from the ratings it summarises.
 */
export async function rateDelivery(deliveryId: string, viewer: Viewer, score: number, comment?: string) {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new AppError(400, 'Bitte vergib 1 bis 5 Sterne.');
  }
  const text = comment?.trim() || null;
  if (text && text.length > 1000) throw new AppError(400, 'Der Kommentar ist zu lang (höchstens 1000 Zeichen).');

  const d = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { status: true, senderId: true, driverId: true, recipientId: true, recipientEmail: true, updatedAt: true, deliveredAt: true },
  });
  const role = d ? roleOf(d, viewer) : null;
  if (!d || !role) throw new AppError(404, 'Delivery not found');
  // One rating each way per delivery: the sender rates the driver, the
  // driver rates the sender. The recipient doesn't add a second rating of
  // the driver — a sender could name their own second account as recipient
  // and rate twice.
  if (role === 'recipient') throw new AppError(403, 'Die sendende Person bewertet diese Lieferung.');
  if (d.status !== 'delivered') throw new AppError(400, 'Bewerten kannst du nach der Zustellung.');
  if ((Date.now() - (d.deliveredAt ?? d.updatedAt).getTime()) / 86_400_000 > RATING_WINDOW_DAYS) {
    throw new AppError(400, `Bewertungen sind bis ${RATING_WINDOW_DAYS} Tage nach der Zustellung möglich.`);
  }
  const toUserId = role === 'driver' ? d.senderId : d.driverId;
  if (!toUserId || toUserId === viewer.userId) throw new AppError(400, 'Hier gibt es niemanden zu bewerten.');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rating.create({
        data: { deliveryRequestId: deliveryId, fromUserId: viewer.userId, toUserId, score, comment: text },
      });
      await tx.$executeRawUnsafe(
        `UPDATE users u
            SET "averageRating" = s.avg, "totalRatings" = s.n
           FROM (SELECT AVG(score)::float AS avg, COUNT(*)::int AS n FROM ratings WHERE "toUserId" = $1) s
          WHERE u.id = $1`,
        toUserId,
      );
    });
  } catch (err: any) {
    if (err?.code === 'P2002') throw new AppError(409, 'Du hast diese Lieferung bereits bewertet.');
    throw err;
  }
  return getMyRating(deliveryId, viewer.userId);
}

export async function getMyRating(deliveryId: string, userId: string) {
  return prisma.rating.findUnique({
    where: { deliveryRequestId_fromUserId: { deliveryRequestId: deliveryId, fromUserId: userId } },
    select: { score: true, comment: true, createdAt: true, toUserId: true },
  });
}
