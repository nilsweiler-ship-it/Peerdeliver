import { prisma } from '../config';
import { generateCode } from '../utils';
import { AppError } from '../middleware';
import type { CreateDeliveryInput, PackageSize } from '@peerdeliver/shared';
import { sizesUpTo, ALL_SIZES, DELIVERY_STATUS_TRANSITIONS } from '@peerdeliver/shared';
import * as paymentService from './payment';
import * as emailService from './email';
import * as pushService from './push';
import * as smsService from './sms';

// All scalar columns (excluding raw geometry) with ST_AsGeoJSON for coordinates
const DELIVERY_COLS = `
  dr.id, dr."senderId", dr."driverId", dr."recipientId", dr."recipientEmail", dr."recipientPhone",
  dr."pickupLabel", dr."deliveryLabel",
  ST_AsGeoJSON(dr."pickupPoint") AS "pickupGeoJSON",
  ST_AsGeoJSON(dr."deliveryPoint") AS "deliveryGeoJSON",
  dr."packageSize", dr."packageWeight", dr."packageDescription", dr."packaging", dr."declaredValue",
  dr."budgetCHF", dr."platformFeeCHF",
  dr."deliveryWindowStart", dr."deliveryWindowEnd",
  dr.status, dr."offeredRouteId", dr."pickupCode", dr."deliveryCode",
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
  recipientPhone?: string;
  pickupLabel: string;
  pickupGeoJSON: string;
  deliveryLabel: string;
  deliveryGeoJSON: string;
  offeredRouteId?: string | null;
  packageSize: string;
  packageWeight?: number;
  packageDescription?: string;
  packaging?: string;
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
  const recipientPhone = input.recipientPhone?.trim() || null;
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
      id, "senderId", "recipientId", "recipientEmail", "recipientPhone",
      "pickupLabel", "pickupPoint", "deliveryLabel", "deliveryPoint",
      "packageSize", "packageWeight", "packageDescription", "packaging", "declaredValue",
      "budgetCHF", "deliveryWindowStart", "deliveryWindowEnd",
      status, "pickupCode", "deliveryCode", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${senderId}, ${recipientId}, ${recipientEmail}, ${recipientPhone},
      ${input.pickupAddress.label},
      ST_SetSRID(ST_MakePoint(${input.pickupAddress.point.lng}, ${input.pickupAddress.point.lat}), 4326),
      ${input.deliveryAddress.label},
      ST_SetSRID(ST_MakePoint(${input.deliveryAddress.point.lng}, ${input.deliveryAddress.point.lat}), 4326),
      ${input.packageSize}::"PackageSize", ${input.packageWeight ?? null}, ${input.packageDescription ?? null},
      ${input.packaging ?? null}::"Packaging",
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

export async function updateDeliveryStatus(
  id: string,
  status: string,
  cancelledBy?: string,
  cancelReason?: string,
  actorId?: string,
) {
  const current = await getDeliveryById(id);
  if (!current) throw new AppError(404, 'Delivery not found');

  // Who may touch this delivery at all. Previously nobody checked, so any
  // signed-in account could drive a stranger's delivery through its whole
  // lifecycle by id alone.
  if (actorId) {
    const involved =
      current.senderId === actorId ||
      current.driverId === actorId ||
      current.recipientId === actorId;
    if (!involved) throw new AppError(403, 'Not authorized');
  }

  // And which moves are legal from here. Without this the offered driver could
  // PATCH straight to 'accepted', skipping the payout-eligibility gate in
  // acceptOffer and leaving the chat thread that accept creates missing.
  const allowed = DELIVERY_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(400, `Nicht möglich: ${current.status} → ${status}`);
  }

  await prisma.$queryRawUnsafe(
    `UPDATE delivery_requests SET status = $1::"DeliveryStatus", "cancelledBy" = $2, "cancelReason" = $3, "updatedAt" = NOW() WHERE id = $4 AND status = $5::"DeliveryStatus"`,
    status,
    cancelledBy ?? null,
    cancelReason ?? null,
    id,
    current.status,
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
/**
 * Is this user one of the three people involved in a delivery?
 *
 * The same question the tracking handler asks before streaming GPS. Chat needed
 * it too: messages were fetched and posted by delivery id alone, so any signed-in
 * account could read a stranger's conversation — which routinely contains a home
 * address, a phone number and a handover time — or post into it while
 * impersonating nobody in particular.
 */
export async function isDeliveryParticipant(deliveryId: string, userId: string): Promise<boolean> {
  const row = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { senderId: true, driverId: true, recipientId: true },
  });
  if (!row) return false;
  return row.senderId === userId || row.driverId === userId || row.recipientId === userId;
}

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

/**
 * Sender-initiated match: offer a delivery to one driver's published route.
 *
 * The mirror of assignDelivery. A sender who finds a route that suits them can
 * now act on it instead of waiting to be found — until now the search screen
 * could show a match the sender had no way to contact.
 *
 * Every guard below closes a way this could go wrong for someone: offering a
 * delivery you do not own, offering one that already has a driver, offering to
 * yourself, or offering a parcel the driver has already said they cannot fit.
 * The size check in particular is worth failing loudly rather than letting a
 * driver discover the problem at the doorstep.
 */
export async function offerToRoute(deliveryId: string, senderId: string, routeId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.senderId !== senderId) {
    throw new AppError(403, 'Not authorized');
  }
  if (delivery.status !== 'pending') {
    throw new AppError(400, 'Diese Lieferung wartet bereits auf eine Antwort');
  }
  if (delivery.driverId) {
    throw new AppError(400, 'Diese Lieferung hat bereits eine fahrende Person');
  }

  const route = await prisma.driverRoute.findUnique({
    where: { id: routeId },
    select: { id: true, driverId: true, isActive: true, availableSize: true },
  });
  if (!route) throw new AppError(404, 'Route nicht gefunden');
  if (!route.isActive) throw new AppError(400, 'Diese Route ist nicht mehr aktiv');
  if (route.driverId === senderId) {
    throw new AppError(400, 'Du kannst deine eigene Route nicht anfragen');
  }
  if (!sizesUpTo(route.availableSize).includes(delivery.packageSize as PackageSize)) {
    throw new AppError(400, 'Diese Route hat nicht genug Platz für dieses Paket');
  }
  // Weight as well as size. The driver-initiated list filters on both, and
  // checking only one here would let a 28 kg parcel reach a driver whose
  // profile says 10 kg — discovered at the doorstep, which is the exact
  // failure these guards exist to prevent.
  const driverProfile = await prisma.user.findUnique({
    where: { id: route.driverId },
    select: { maxLoadKg: true },
  });
  if (
    driverProfile?.maxLoadKg != null &&
    delivery.packageWeight != null &&
    delivery.packageWeight > driverProfile.maxLoadKg
  ) {
    throw new AppError(400, 'Dieses Paket ist schwerer, als diese Route tragen kann');
  }

  // The WHERE re-asserts what we read above, so two taps cannot both win. The
  // row count then tells us whether *this* call was the winner — without it,
  // the loser would still send the driver an email and a push about a delivery
  // that went to someone else.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET "driverId" = $1, "offeredRouteId" = $2,
            status = 'offered'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $3 AND status = 'pending'::"DeliveryStatus" AND "driverId" IS NULL`,
    route.driverId,
    routeId,
    deliveryId,
  );
  if (applied === 0) {
    throw new AppError(409, 'Diese Lieferung wurde soeben schon vergeben');
  }

  const ctx = await notifyContext(deliveryId);
  if (ctx?.driver?.email) {
    emailService.sendDeliveryOffered({
      to: ctx.driver.email,
      senderName: ctx.sender?.firstName ?? 'Eine Person',
      route: ctx.route,
      priceCHF: ctx.d.budgetCHF,
      itemDescription: ctx.d.packageDescription ?? null,
      language: ctx.driver.language,
    });
  }
  // Notify the driver actually written to the row, not the one this caller
  // aimed at — they are the same only when this call won.
  if (ctx?.d.driverId) {
    pushService.notifyDeliveryOffered(
      ctx.d.driverId,
      ctx?.sender?.firstName ?? 'Eine Person',
      deliveryId,
    );
  }

  return getDeliveryById(deliveryId);
}

/**
 * The sender withdraws an offer nobody answered.
 *
 * Without this an ignored request is a trap: the delivery is invisible to every
 * other driver (the open pool is `pending` only), no expiry job exists, and the
 * sender's money is already on hold. Silence by one driver would strand the
 * parcel permanently.
 */
export async function withdrawOffer(deliveryId: string, senderId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.senderId !== senderId) {
    throw new AppError(403, 'Not authorized');
  }
  if (delivery.status !== 'offered') {
    throw new AppError(400, 'Diese Anfrage ist nicht mehr offen');
  }

  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET "driverId" = NULL, "offeredRouteId" = NULL,
            status = 'pending'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $1 AND status = 'offered'::"DeliveryStatus"`,
    deliveryId,
  );
  if (applied === 0) {
    // The driver answered in the meantime — their answer stands.
    throw new AppError(409, 'Die fahrende Person hat inzwischen geantwortet');
  }

  return getDeliveryById(deliveryId);
}

/**
 * Return any open offers on a route to the pool.
 *
 * Called when a driver deactivates or deletes a route. The offer was made
 * against a promise that no longer exists, and leaving it open would hold the
 * sender's delivery hostage to a route that is gone.
 */
export async function reopenOffersForRoute(routeId: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE delivery_requests
          SET "driverId" = NULL, "offeredRouteId" = NULL,
              status = 'pending'::"DeliveryStatus", "updatedAt" = NOW()
        WHERE "offeredRouteId" = $1 AND status = 'offered'::"DeliveryStatus"`,
      routeId,
    );
  } catch (err) {
    console.error('[reopenOffers]', err instanceof Error ? err.message : err);
  }
}

/**
 * The offered driver accepts. Goes straight to `matched` — the sender already
 * chose this driver, so there is nothing left for them to confirm.
 */
export async function acceptOffer(deliveryId: string, driverId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.driverId !== driverId) {
    throw new AppError(403, 'Not authorized');
  }
  if (delivery.status !== 'offered') {
    throw new AppError(400, 'Diese Anfrage ist nicht mehr offen');
  }
  // Same gate as claiming a delivery: we must be able to pay this person.
  if (!(await paymentService.driverCanReceivePayouts(driverId))) {
    throw new AppError(400, 'Complete payout setup before accepting deliveries');
  }

  // Row count, not just the WHERE: on a double tap or a cancellation that
  // lands between the read and the write, the loser must not post a second
  // "confirmed" chat message or email the sender a pickup code for a delivery
  // that is no longer going anywhere.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET status = 'matched'::"DeliveryStatus", "offeredRouteId" = NULL, "updatedAt" = NOW()
      WHERE id = $1 AND status = 'offered'::"DeliveryStatus"`,
    deliveryId,
  );
  if (applied === 0) {
    throw new AppError(409, 'Diese Anfrage ist nicht mehr offen');
  }

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { firstName: true },
  });
  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: driverId,
      content: `${driver?.firstName ?? 'Driver'} has been confirmed for this delivery. You can now chat about pickup details.`,
    },
  });

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

/**
 * The offered driver declines. The delivery returns to the open pool rather
 * than dying — a decline is not a cancellation, and the sender should not have
 * to re-create it.
 */
export async function declineOffer(deliveryId: string, driverId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.driverId !== driverId) {
    throw new AppError(403, 'Not authorized');
  }
  if (delivery.status !== 'offered') {
    throw new AppError(400, 'Diese Anfrage ist nicht mehr offen');
  }

  const ctx = await notifyContext(deliveryId);
  const driverName = ctx?.driver?.firstName ?? 'Die fahrende Person';

  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET "driverId" = NULL, "offeredRouteId" = NULL,
            status = 'pending'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $1 AND status = 'offered'::"DeliveryStatus"`,
    deliveryId,
  );
  if (applied === 0) {
    throw new AppError(409, 'Diese Anfrage ist nicht mehr offen');
  }

  if (ctx?.sender?.email) {
    emailService.sendOfferDeclined({
      to: ctx.sender.email,
      driverName,
      route: ctx.route,
      language: ctx.sender.language,
    });
  }
  if (ctx?.d.senderId) {
    pushService.notifyOfferDeclined(ctx.d.senderId, driverName, deliveryId);
  }

  return getDeliveryById(deliveryId);
}

export async function assignDelivery(deliveryId: string, driverId: string) {
  // In real-payment mode, block drivers who haven't completed payout onboarding —
  // otherwise we couldn't pay them out on delivery. (No-op in simulated mode.)
  if (!(await paymentService.driverCanReceivePayouts(driverId))) {
    throw new AppError(400, 'Complete payout setup before accepting deliveries');
  }

  // Driver requests — sets status to 'requested', sender must confirm.
  //
  // The WHERE clause matters as much as the update. Without it this statement
  // overwrote whatever it found, so any driver could claim a delivery that was
  // already offered to someone else: the driver the sender personally chose
  // silently lost the job, and the sender saw a request from a stranger.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET "driverId" = $1, status = 'requested'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $2 AND status = 'pending'::"DeliveryStatus" AND "driverId" IS NULL`,
    driverId,
    deliveryId,
  );
  if (applied === 0) {
    throw new AppError(409, 'Diese Lieferung ist nicht mehr offen');
  }

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
  // A recipient reached only by phone has no account and no app — SMS is the
  // only way they learn the parcel is coming, and they need the code to accept it.
  if (ctx?.d.recipientPhone && ctx.d.deliveryCode) {
    smsService.notifyRecipientPickedUp(ctx.d.recipientPhone, ctx.route, ctx.d.deliveryCode);
  }
  // The recipient needs the code too. Nothing used to be addressed to them at
  // all, so a recipient without an account could only get it by the sender
  // reading it out — which is not a system, just a workaround that held.
  if (ctx?.d.recipientEmail && ctx.d.deliveryCode) {
    emailService.sendRecipientPickedUp({
      to: ctx.d.recipientEmail,
      route: ctx.route,
      deliveryCode: ctx.d.deliveryCode,
      senderName: ctx.sender?.firstName ?? null,
      language: ctx.sender?.language,
    });
  }

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
  // Packaging avoided, in kg CO2e. A courier shipment of this size would need a
  // new corrugated box; a hand-to-hand handover often needs nothing at all.
  //
  // Basis: roughly 0.7 kg CO2e per kg of corrugated board produced. Typical box
  // weights by parcel size are ~0.15 kg (S), ~0.35 kg (M), ~0.8 kg (L), giving
  // the figures below. Deliberately conservative — we would rather understate
  // this number than have a partner audit it and find it inflated.
  const PACKAGING_SAVED_KG: Record<string, Record<string, number>> = {
    none: { S: 0.11, M: 0.25, L: 0.56 },
    // Reusing a box that already exists avoids producing a new one, but the
    // material was still made once, so credit is partial.
    reused: { S: 0.05, M: 0.12, L: 0.28 },
    // A new box is the courier baseline: no saving, but no penalty either.
    cardboard: { S: 0, M: 0, L: 0 },
    other: { S: 0, M: 0, L: 0 },
  };

  const row = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { packaging: true, packageSize: true },
  });

  const transportSavedKg = (km || 0) * 0.12;
  const packagingSavedKg =
    PACKAGING_SAVED_KG[row?.packaging ?? 'cardboard']?.[row?.packageSize ?? 'M'] ?? 0;

  const co2SavedKg = Math.round((transportSavedKg + packagingSavedKg) * 100) / 100;

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

/**
 * Tell the recipient a parcel has been registered for them.
 *
 * Fired once the payment is authorised rather than at the raw moment of
 * creation. The gap is usually seconds, but a delivery abandoned at the payment
 * step would otherwise email someone about a parcel that never existed — a poor
 * first impression of a service they have never heard of.
 *
 * Idempotent by status: only announces while the delivery is still pending or
 * requested, so a re-authorisation or webhook retry cannot send it twice.
 */
export async function announceToRecipient(deliveryId: string): Promise<void> {
  try {
    const ctx = await notifyContext(deliveryId);
    if (!ctx?.d.recipientEmail) return;
    // 'offered' belongs here too: a sender can pick a route before completing
    // payment, and the announcement fires on payment. Omitting it meant the
    // recipient — often someone with no account, for whom this is the only
    // contact they will get — was never told a parcel was coming.
    if (ctx.d.status !== 'pending' && ctx.d.status !== 'requested' && ctx.d.status !== 'offered') {
      return;
    }

    emailService.sendRecipientAnnounced({
      to: ctx.d.recipientEmail,
      route: ctx.route,
      itemDescription: ctx.d.packageDescription ?? null,
      senderName: ctx.sender?.firstName ?? null,
      language: ctx.sender?.language,
    });
  } catch (err) {
    // Never let a notification failure affect a payment path.
    console.error('[announce]', err instanceof Error ? err.message : err);
  }
}
