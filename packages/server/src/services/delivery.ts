import { prisma } from '../config';
import { generateCode } from '../utils';
import { AppError } from '../middleware';
import type { CreateDeliveryInput } from '@peerdeliver/shared';
import { stripeConfigured } from './stripe';
import * as paymentService from './payment';

// All scalar columns (excluding raw geometry) with ST_AsGeoJSON for coordinates
const DELIVERY_COLS = `
  dr.id, dr."senderId", dr."driverId",
  dr."pickupLabel", dr."deliveryLabel",
  ST_AsGeoJSON(dr."pickupPoint") AS "pickupGeoJSON",
  ST_AsGeoJSON(dr."deliveryPoint") AS "deliveryGeoJSON",
  dr."packageSize", dr."packageWeight", dr."packageDescription", dr."declaredValue",
  dr."budgetCHF", dr."platformFeeCHF",
  dr."deliveryWindowStart", dr."deliveryWindowEnd",
  dr.status, dr."pickupCode", dr."deliveryCode",
  dr."co2SavedKg", dr."cancelledBy", dr."cancelReason",
  dr."stripePaymentIntentId", dr."paymentStatus", dr."driverPayoutCHF",
  dr."stripeTransferId", dr."refundedCHF", dr."refundedAt",
  dr."createdAt", dr."updatedAt"
`;

interface RawDeliveryRow {
  id: string;
  senderId: string;
  driverId?: string;
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

  const inserted: { id: string }[] = await prisma.$queryRaw`
    INSERT INTO delivery_requests (
      id, "senderId", "pickupLabel", "pickupPoint", "deliveryLabel", "deliveryPoint",
      "packageSize", "packageWeight", "packageDescription", "declaredValue",
      "budgetCHF", "deliveryWindowStart", "deliveryWindowEnd",
      status, "pickupCode", "deliveryCode", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${senderId}, ${input.pickupAddress.label},
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

  let clientSecret: string | null = null;
  if (stripeConfigured()) {
    const intent = await paymentService.createPaymentIntentForDelivery(inserted[0].id, input.budgetCHF);
    clientSecret = intent.clientSecret;
  }

  // Re-fetch after payment intent creation so stripePaymentIntentId is in the response.
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
  // Void any outstanding authorisation when the delivery is cancelled for good.
  // Reject-and-reassign goes to 'pending' (not 'cancelled') so the auth stays live.
  if (status === 'cancelled' && stripeConfigured()) {
    await paymentService.voidIntentOnCancel(id);
  }
  return getDeliveryById(id);
}

export async function getNearbyDeliveries(lat: number, lng: number, radiusKm: number = 50) {
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
    ORDER BY "distanceKm" ASC
    LIMIT 50`,
    lat,
    lng,
    radiusKm * 1000,
  );
  return rows.map(transformDelivery);
}

export async function assignDelivery(deliveryId: string, driverId: string) {
  // When payments are live, block drivers who haven't completed Stripe onboarding —
  // otherwise we'd have no way to pay them when the delivery completes.
  if (stripeConfigured()) {
    const driver = await prisma.user.findUnique({ where: { id: driverId }, select: { stripePayoutsEnabled: true } });
    if (!driver?.stripePayoutsEnabled) {
      throw new AppError(400, 'Driver payout setup incomplete');
    }
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

  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: driverId,
      content: 'Package delivered successfully!',
    },
  });

  // Capture funds and transfer driver's cut. No-op when Stripe isn't configured
  // or when the delivery predates the payment system.
  if (stripeConfigured()) {
    await paymentService.captureAndPayoutOnDelivered(deliveryId);
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
