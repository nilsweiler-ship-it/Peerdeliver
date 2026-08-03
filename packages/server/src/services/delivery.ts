import { prisma } from '../config';
import { generateCode } from '../utils';
import { AppError } from '../middleware';
import type { CreateDeliveryInput, PackageSize } from '@peerdeliver/shared';
import { sizesUpTo, ALL_SIZES } from '@peerdeliver/shared';
import * as paymentService from './payment';
import * as emailService from './email';
import * as pushService from './push';

// All scalar columns (excluding raw geometry) with ST_AsGeoJSON for coordinates
const DELIVERY_COLS = `
  dr.id, dr."senderId", dr."driverId", dr."recipientId", dr."recipientEmail",
  dr."pickupLabel", dr."deliveryLabel",
  ST_AsGeoJSON(dr."pickupPoint") AS "pickupGeoJSON",
  ST_AsGeoJSON(dr."deliveryPoint") AS "deliveryGeoJSON",
  dr."packageSize", dr."packageWeight", dr."packageDescription", dr."declaredValue",
  dr."budgetCHF", dr."platformFeeCHF",
  dr."deliveryWindowStart", dr."deliveryWindowEnd",
  dr.status, dr."pickupCode", dr."deliveryCode",
  dr."co2SavedKg", dr."cancelledBy", dr."cancelReason",
  dr."twintRef", dr."twintPhone", dr."paymentStatus", dr."driverPayoutCHF",
  dr."stripePaymentIntentId", dr."stripeTransferId", dr."refundedCHF", dr."refundedAt",
  dr."createdAt", dr."updatedAt"
`;

interface RawDeliveryRow {
  id: string;
  senderId: string;
  driverId?: string;
  recipientId?: string;
  recipientEmail?: string;
  pickupLabel: string;
  pickupGeoJSON: string;
  deliveryLabel: string;
  deliveryGeoJSON: string;
  packageSize: string;
  packageWeight?: number;
  packageDescription?: string;
  declaredValue?: number;
  budgetCHF: number;
  platformFeeCHF?: number;
  deliveryWindowStart: Date;
  deliveryWindowEnd: Date;
  status: string;
  pickupCode?: string;
  deliveryCode?: string;
  co2SavedKg?: number;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
  distanceKm?: number;
  sender?: unknown;
  [key: string]: unknown;
}

function transformDelivery(row: RawDeliveryRow) {
  const pickupCoords = JSON.parse(row.pickupGeoJSON).coordinates;
  const deliveryCoords = JSON.parse(row.deliveryGeoJSON).coordinates;

  const { pickupLabel, pickupGeoJSON, deliveryLabel, deliveryGeoJSON, ...rest } = row;

  return {
    ...rest,
    pickupAddress: {
      label: pickupLabel,
      point: { lat: pickupCoords[1], lng: pickupCoords[0] },
    },
    deliveryAddress: {
      label: deliveryLabel,
      point: { lat: deliveryCoords[1], lng: deliveryCoords[0] },
    },
  };
}

export async function createDelivery(senderId: string, input: CreateDeliveryInput) {
  const pickupCode = generateCode();
  const deliveryCode = generateCode();

  // Resolve the recipient email to a registered user when one exists, so the
  // delivery shows up in their incoming list immediately. The email is also
  // stored verbatim so a recipient who registers later can still be matched.
  const recipientEmail = input.recipientEmail?.toLowerCase() ?? null;
  let recipientId: string | null = null;
  if (recipientEmail) {
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { id: true },
    });
    recipientId = recipient?.id ?? null;
  }

  const inserted: { id: string }[] = await prisma.$queryRaw`
    INSERT INTO delivery_requests (
      id, "senderId", "recipientId", "recipientEmail",
      "pickupLabel", "pickupPoint", "deliveryLabel", "deliveryPoint",
      "packageSize", "packageWeight", "packageDescription", "declaredValue",
      "budgetCHF", "deliveryWindowStart", "deliveryWindowEnd",
      status, "pickupCode", "deliveryCode", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${senderId}, ${recipientId}, ${recipientEmail},
      ${input.pickupAddress.label},
      ST_SetSRID(ST_MakePoint(${input.pickupAddress.point.lng}, ${input.pickupAddress.point.lat}), 4326),
      ${input.deliveryAddress.label},
      ST_SetSRID(ST_MakePoint(${input.deliveryAddress.point.lng}, ${input.deliveryAddress.point.lat}), 4326),
      ${input.packageSize}::"PackageSize", ${input.packageWeight ?? null}, ${input.packageDescription ?? null},
      ${input.declaredValue ?? null}, ${input.budgetCHF},
      ${new Date(input.deliveryWindowStart)}, ${new Date(input.deliveryWindowEnd)},
      'pending'::"DeliveryStatus", ${pickupCode}, ${deliveryCode},
      NOW(), NOW()
    )
    RETURNING id
  `;

  // Real mode: create a Stripe TWINT PaymentIntent and return its clientSecret for
  // the app to confirm. Sim mode: returns null and the sender confirms via
  // POST /payments/twint/pay. Either way the delivery starts 'unpaid'.
  const clientSecret = await paymentService.createPaymentForDelivery(inserted[0].id, input.budgetCHF);
  const delivery = await getDeliveryById(inserted[0].id);
  return { ...delivery, clientSecret };
}

export async function getDeliveriesBySender(senderId: string) {
  const rows: RawDeliveryRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${DELIVERY_COLS} FROM delivery_requests dr WHERE dr."senderId" = $1 ORDER BY dr."createdAt" DESC`,
    senderId,
  );
  return rows.map(transformDelivery);
}

export async function getDeliveriesByDriver(driverId: string) {
  const rows: RawDeliveryRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${DELIVERY_COLS} FROM delivery_requests dr WHERE dr."driverId" = $1 ORDER BY dr."createdAt" DESC`,
    driverId,
  );
  return rows.map(transformDelivery);
}

export async function getDeliveriesByRecipient(recipientId: string, email: string) {
  // Match on the linked recipientId (set when the recipient was registered at
  // creation time) or on the raw email (recipient registered after creation).
  const rows: RawDeliveryRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${DELIVERY_COLS} FROM delivery_requests dr
       WHERE dr."recipientId" = $1 OR LOWER(dr."recipientEmail") = LOWER($2)
       ORDER BY dr."createdAt" DESC`,
    recipientId,
    email,
  );
  return rows.map(transformDelivery);
}

export async function getDeliveryById(id: string) {
  const rows: RawDeliveryRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${DELIVERY_COLS} FROM delivery_requests dr WHERE dr.id = $1 LIMIT 1`,
    id,
  );
  return rows[0] ? transformDelivery(rows[0]) : null;
}

export async function updateDeliveryStatus(id: string, status: string, cancelledBy?: string, cancelReason?: string) {
  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET status = $1::"DeliveryStatus", "cancelledBy" = $2, "cancelReason" = $3, "updatedAt" = NOW() WHERE id = $4`,
    status,
    cancelledBy ?? null,
    cancelReason ?? null,
    id,
  );
  // Refund/void any outstanding TWINT hold when the delivery is cancelled for good.
  // Reject-and-reassign goes to 'pending' (not 'cancelled') so the hold stays live.
  if (status === 'cancelled') {
    await paymentService.voidOnCancel(id);
  }
  return getDeliveryById(id);
}

export async function getNearbyDeliveries(
  lat: number,
  lng: number,
  radiusKm: number = 50,
  capacity?: { vehicleSize?: PackageSize | null; maxLoadKg?: number | null },
) {
  // Only surface deliveries this driver's vehicle can actually carry.
  const allowed = capacity?.vehicleSize ? sizesUpTo(capacity.vehicleSize) : ALL_SIZES;
  const maxLoad = capacity?.maxLoadKg ?? null;

  const rows: RawDeliveryRow[] = await prisma.$queryRawUnsafe(
    `SELECT ${DELIVERY_COLS},
      ST_Distance(
        dr."pickupPoint"::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) / 1000 AS "distanceKm",
      json_build_object(
        'id', u.id, 'firstName', u."firstName", 'lastName', u."lastName", 'avatarUrl', u."avatarUrl",
        'averageRating', u."averageRating", 'totalRatings', u."totalRatings", 'totalDeliveries', u."totalDeliveries"
      ) AS sender
    FROM delivery_requests dr
    JOIN users u ON u.id = dr."senderId"
    WHERE dr.status = 'pending'
      AND ST_DWithin(
        dr."pickupPoint"::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
      AND dr."packageSize"::text = ANY($4::text[])
      AND ($5::float IS NULL OR dr."packageWeight" IS NULL OR dr."packageWeight" <= $5)
    ORDER BY "distanceKm" ASC
    LIMIT 50`,
    lat,
    lng,
    radiusKm * 1000,
    allowed,
    maxLoad,
  );
  return rows.map(transformDelivery);
}

/**
 * Look up the people to notify for a delivery plus a human route label.
 * Kept tolerant: any missing piece just means that mail is skipped.
 */
async function notifyContext(deliveryId: string) {
  const d = await getDeliveryById(deliveryId);
  if (!d) return null;
  const [sender, driver] = await Promise.all([
    d.senderId
      ? prisma.user.findUnique({ where: { id: d.senderId }, select: { email: true, firstName: true, language: true } })
      : null,
    d.driverId
      ? prisma.user.findUnique({ where: { id: d.driverId }, select: { email: true, firstName: true, language: true } })
      : null,
  ]);
  const route = `${d.pickupAddress.label} → ${d.deliveryAddress.label}`;
  return { d, sender, driver, route };
}

export async function assignDelivery(deliveryId: string, driverId: string) {
  // In real-payment mode, block drivers who haven't completed payout onboarding —
  // otherwise we couldn't pay them out on delivery. (No-op in simulated mode.)
  if (!(await paymentService.driverCanReceivePayouts(driverId))) {
    throw new AppError(400, 'Complete payout setup before accepting deliveries');
  }

  // Driver requests — sets status to 'requested', sender must confirm
  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET "driverId" = $1, status = 'requested'::"DeliveryStatus", "updatedAt" = NOW() WHERE id = $2`,
    driverId,
    deliveryId,
  );

  return getDeliveryById(deliveryId);
}

export async function confirmDelivery(deliveryId: string, senderId: string) {
  // Sender confirms the driver — sets status to 'matched' and opens chat
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.senderId !== senderId) {
    throw new AppError(403, 'Not authorized');
  }
  if (delivery.status !== 'requested') {
    throw new AppError(400, 'Delivery is not in requested state');
  }

  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET status = 'matched'::"DeliveryStatus", "updatedAt" = NOW() WHERE id = $1`,
    deliveryId,
  );

  // Create initial chat message
  const driver = await prisma.user.findUnique({ where: { id: delivery.driverId! }, select: { firstName: true } });
  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: delivery.driverId!,
      content: `${driver?.firstName ?? 'Driver'} has been confirmed for this delivery. You can now chat about pickup details.`,
    },
  });

  // Notify the sender that a driver is confirmed (fire-and-forget).
  const ctx = await notifyContext(deliveryId);
  if (ctx?.sender?.email) {
    emailService.sendDeliveryMatched({
      to: ctx.sender.email,
      driverName: driver?.firstName ?? 'Eine fahrende Person',
      route: ctx.route,
      priceCHF: ctx.d.budgetCHF,
      pickupCode: ctx.d.pickupCode,
      language: ctx.sender.language,
    });
  }
  if (ctx?.d.senderId) {
    pushService.notifyDeliveryMatched(
      ctx.d.senderId,
      driver?.firstName ?? 'Eine fahrende Person',
      deliveryId,
    );
  }

  return getDeliveryById(deliveryId);
}

export async function verifyPickup(deliveryId: string, driverId: string, code: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.driverId !== driverId) throw new AppError(403, 'Not authorized');
  if (delivery.status !== 'accepted') throw new AppError(400, 'Delivery is not in accepted state');
  if (delivery.pickupCode !== code) throw new AppError(400, 'Invalid pickup code');

  // Move to in_transit (skipping picked_up since both parties confirmed via code)
  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET status = 'in_transit'::"DeliveryStatus", "updatedAt" = NOW() WHERE id = $1`,
    deliveryId,
  );

  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: driverId,
      content: 'Package picked up. Delivery is in transit.',
    },
  });

  const ctx = await notifyContext(deliveryId);
  if (ctx?.sender?.email) {
    emailService.sendPickedUp({
      to: ctx.sender.email,
      route: ctx.route,
      deliveryCode: ctx.d.deliveryCode,
      language: ctx.sender.language,
    });
  }
  if (ctx?.d.senderId) pushService.notifyPickedUp(ctx.d.senderId, deliveryId);

  return getDeliveryById(deliveryId);
}

export async function verifyDelivery(deliveryId: string, driverId: string, code: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.driverId !== driverId) throw new AppError(403, 'Not authorized');
  if (delivery.status !== 'in_transit') throw new AppError(400, 'Delivery is not in transit');
  if (delivery.deliveryCode !== code) throw new AppError(400, 'Invalid delivery code');

  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET status = 'delivered'::"DeliveryStatus", "updatedAt" = NOW() WHERE id = $1`,
    deliveryId,
  );

  // ── Impact + stats ──────────────────────────────────────────────
  // CO₂ saved ≈ the dedicated car trip this delivery avoided (the driver was
  // already heading that way). distance_km × 0.12 kg CO₂/km (avg small car).
  const [{ km }] = await prisma.$queryRawUnsafe<{ km: number }[]>(
    `SELECT ST_Distance(dr."pickupPoint"::geography, dr."deliveryPoint"::geography) / 1000 AS km
       FROM delivery_requests dr WHERE dr.id = $1`,
    deliveryId,
  );
  const co2SavedKg = Math.round((km || 0) * 0.12 * 100) / 100;

  await prisma.deliveryRequest.update({ where: { id: deliveryId }, data: { co2SavedKg } });
  // Credit both parties' lifetime impact; the driver also gets a completed delivery.
  await prisma.user.update({
    where: { id: driverId },
    data: { co2Saved: { increment: co2SavedKg }, totalDeliveries: { increment: 1 } },
  });
  if (delivery.senderId) {
    await prisma.user.update({
      where: { id: delivery.senderId },
      data: { co2Saved: { increment: co2SavedKg } },
    });
  }

  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: driverId,
      content: 'Package delivered successfully!',
    },
  });

  // Split the budget and credit the driver. No-op if the sender never paid.
  await paymentService.captureAndPayoutOnDelivered(deliveryId);

  // Closing notifications: receipt to the sender, payout note to the driver.
  const ctx = await notifyContext(deliveryId);
  if (ctx) {
    if (ctx.sender?.email) {
      emailService.sendDelivered({
        to: ctx.sender.email,
        route: ctx.route,
        priceCHF: ctx.d.budgetCHF,
        co2SavedKg,
        language: ctx.sender.language,
      });
    }
    if (ctx.driver?.email) {
      const split = paymentService.computeSplit(ctx.d.budgetCHF);
      emailService.sendDriverPayout({
        to: ctx.driver.email,
        route: ctx.route,
        payoutCHF: split.driverPayoutCHF,
        feeCHF: split.platformFeeCHF,
        language: ctx.driver.language,
      });
    }
    if (ctx.d.senderId) pushService.notifyDelivered(ctx.d.senderId, deliveryId);
    if (ctx.d.driverId) {
      const split = paymentService.computeSplit(ctx.d.budgetCHF);
      pushService.notifyDriverPayout(ctx.d.driverId, split.driverPayoutCHF, deliveryId);
    }
  }

  return getDeliveryById(deliveryId);
}

export async function rejectDriver(deliveryId: string, senderId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.senderId !== senderId) {
    throw new AppError(403, 'Not authorized');
  }

  // Reset to pending so other drivers can request
  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET "driverId" = NULL, status = 'pending'::"DeliveryStatus", "updatedAt" = NOW() WHERE id = $1`,
    deliveryId,
  );

  return getDeliveryById(deliveryId);
}
