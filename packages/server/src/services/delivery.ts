import { prisma } from '../config';
import { generateCode } from '../utils';
import { AppError } from '../middleware';
import type { CreateDeliveryInput, PackageSize } from '@peerdeliver/shared';
import { sizesUpTo, ALL_SIZES, DELIVERY_STATUS_TRANSITIONS, computeCo2Saved } from '@peerdeliver/shared';
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
  paymentStatus?: string;
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

/**
 * Who is looking at a delivery, for deciding what they may see.
 *
 * `email` matters because a recipient who registered after the delivery was
 * created is linked by email only, never by recipientId.
 */
export interface DeliveryViewer {
  userId: string;
  email?: string | null;
}

/** Is this viewer the sender, the driver or the recipient of the delivery? */
export function isParticipantView(
  d: { senderId?: string | null; driverId?: string | null; recipientId?: string | null; recipientEmail?: string | null },
  viewer: DeliveryViewer,
): boolean {
  if (d.senderId === viewer.userId || d.driverId === viewer.userId || d.recipientId === viewer.userId) return true;
  return isRecipientByEmail(d, viewer);
}

function isRecipientByEmail(d: { recipientEmail?: string | null }, viewer: DeliveryViewer): boolean {
  return !!viewer.email && !!d.recipientEmail && d.recipientEmail.toLowerCase() === viewer.email.toLowerCase();
}

/** Fields only the sender sees: how they paid. */
const SENDER_ONLY_FIELDS = ['twintRef', 'twintPhone', 'stripePaymentIntentId', 'stripeTransferId'] as const;
/** Fields the sender and the recipient see, but not the person carrying it. */
const SENDER_AND_RECIPIENT_FIELDS = ['recipientEmail', 'recipientPhone'] as const;
/**
 * What a driver browsing open jobs may see of a delivery that is not theirs:
 * enough to decide whether to take it, nothing about the people or the money.
 */
const PUBLIC_FIELDS = [
  'id', 'senderId', 'status', 'pickupAddress', 'deliveryAddress',
  'packageSize', 'packageWeight', 'packageDescription', 'packaging', 'declaredValue',
  'budgetCHF', 'deliveryWindowStart', 'deliveryWindowEnd',
  'createdAt', 'updatedAt', 'distanceKm', 'sender',
] as const;

/**
 * Cut a delivery down to what this viewer is entitled to.
 *
 * The two handover codes are the proof that a parcel changed hands: the
 * driver must be *told* the pickup code by the sender and the delivery code
 * by the recipient, in person. Every delivery read used to return both codes
 * to everyone who could see the delivery — the driver included — so a driver
 * could read the delivery code off the API, confirm a delivery that never
 * happened, and be paid for it.
 *
 *   sender      → everything, including both codes
 *   recipient   → the delivery code, the recipient contact fields; not how
 *                 the sender paid
 *   driver      → the job, no codes, no recipient contact, no payment refs
 *   anyone else → PUBLIC_FIELDS only
 *
 * "Recipient" for the code means linked by recipientId, never by a matching
 * email alone. Emails are not verified at sign-up, so matching on email let a
 * driver register a second account under the recipient's address — which they
 * could read from the delivery — and collect the code with it. A recipient
 * who registered after the delivery was created still gets the code where it
 * was always sent: to their inbox and phone.
 *
 * If one user were both sender and driver (assignDelivery refuses it now), the
 * driver rule wins: whoever carries the parcel must never hold the codes.
 */
export function redactForViewer<T extends Record<string, unknown>>(d: T, viewer: DeliveryViewer): T {
  const isDriver = d.driverId === viewer.userId;
  const isSender = !isDriver && d.senderId === viewer.userId;
  const isLinkedRecipient = !isDriver && d.recipientId === viewer.userId;
  const isRecipient = isLinkedRecipient || (!isDriver && isRecipientByEmail(d as { recipientEmail?: string | null }, viewer));

  if (!isDriver && !isSender && !isRecipient) {
    const out: Record<string, unknown> = {};
    for (const k of PUBLIC_FIELDS) if (k in d) out[k] = d[k];
    return out as T;
  }

  const out: Record<string, unknown> = { ...d };
  delete out.pickupCode;
  delete out.deliveryCode;
  delete out.codeFailedAttempts;
  delete out.codeLockedUntil;
  if (isSender) {
    out.pickupCode = d.pickupCode;
    out.deliveryCode = d.deliveryCode;
    return out as T;
  }
  for (const k of SENDER_ONLY_FIELDS) delete out[k];
  if (isDriver) {
    for (const k of SENDER_AND_RECIPIENT_FIELDS) delete out[k];
    return out as T;
  }
  if (isLinkedRecipient) out.deliveryCode = d.deliveryCode;
  return out as T;
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
    // Case-insensitive: an account registered as Bob@x.ch is the same
    // mailbox as bob@x.ch, and used to go unlinked.
    const recipient = await prisma.user.findFirst({
      where: { email: { equals: recipientEmail, mode: 'insensitive' } },
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
  if (!actorId) throw new AppError(403, 'Not authorized');
  const current = await getDeliveryById(id);
  if (!current) throw new AppError(404, 'Delivery not found');

  // Who may touch this delivery at all. Previously nobody checked, so any
  // signed-in account could drive a stranger's delivery through its whole
  // lifecycle by id alone.
  const isSender = current.senderId === actorId;
  const isDriver = current.driverId === actorId;
  if (!isSender && !isDriver && current.recipientId !== actorId) {
    throw new AppError(403, 'Not authorized');
  }

  // The generic endpoint does exactly two things. Everything else in the
  // lifecycle has its own endpoint, because everything else needs a proof the
  // generic one cannot ask for: picked_up / in_transit need the sender's pickup
  // code, delivered needs the recipient's delivery code. This endpoint used to
  // accept those too, so a driver could PATCH straight to 'delivered' with no
  // code at all.
  if (status !== 'accepted' && status !== 'cancelled') {
    throw new AppError(400, `Nicht möglich: ${current.status} → ${status}`);
  }
  const allowed = DELIVERY_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(400, `Nicht möglich: ${current.status} → ${status}`);
  }

  if (status === 'accepted') {
    // The driver's "I'm on my way to pick it up". Only theirs to say.
    if (!isDriver) throw new AppError(403, 'Only the driver can accept');
    const applied = await prisma.$executeRawUnsafe(
      `UPDATE delivery_requests SET status = 'accepted'::"DeliveryStatus", "updatedAt" = NOW()
        WHERE id = $1 AND status = 'matched'::"DeliveryStatus"`,
      id,
    );
    if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');
    return getDeliveryById(id);
  }

  return cancelDelivery(current, actorId, isSender, isDriver, cancelReason);
}

/**
 * States in which the parcel is still with the sender, so a cancellation can
 * simply undo everything and refund. Once the pickup code has been used the
 * parcel is in a stranger's car, and "cancel, full refund" is no longer an
 * honest description of what is happening — that is a dispute.
 */
const CANCELLABLE_BEFORE_PICKUP = ['pending', 'requested', 'offered', 'matched', 'accepted'];

async function cancelDelivery(
  current: NonNullable<Awaited<ReturnType<typeof getDeliveryById>>>,
  actorId: string,
  isSender: boolean,
  isDriver: boolean,
  cancelReason?: string,
) {
  const id = current.id;

  // The recipient did not book or pay for this and cannot call it off. They
  // used to be able to cancel even mid-transit and trigger a full refund to
  // the sender.
  if (!isSender && !isDriver) {
    throw new AppError(403, 'Nur die sendende oder die fahrende Person kann eine Lieferung stornieren');
  }

  if (!CANCELLABLE_BEFORE_PICKUP.includes(current.status)) {
    throw new AppError(
      409,
      'Das Paket wurde bereits abgeholt und kann nicht mehr storniert werden. Bitte kontaktiere den Support.',
    );
  }

  if (isDriver) {
    // An unanswered offer has its own path, with its own notifications.
    if (current.status === 'offered') return declineOffer(id, actorId);

    // A driver backing out is a decline, not the end of the delivery: the
    // sender still wants the parcel moved and has already paid. Return it to
    // the open pool with the hold intact. A driver used to be able to cancel
    // the sender's whole delivery this way.
    const ctx = await notifyContext(id);
    const applied = await prisma.$executeRawUnsafe(
      `UPDATE delivery_requests
          SET "driverId" = NULL, "offeredRouteId" = NULL,
              status = 'pending'::"DeliveryStatus", "updatedAt" = NOW()
        WHERE id = $1 AND status = $2::"DeliveryStatus" AND "driverId" = $3`,
      id,
      current.status,
      actorId,
    );
    if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');

    // The sender must hear about it: their app would otherwise just flip back
    // to "waiting" while the chat still says this driver is confirmed.
    const driverName = ctx?.driver?.firstName ?? 'Die fahrende Person';
    await prisma.message.create({
      data: {
        deliveryRequestId: id,
        senderId: actorId,
        content: `${driverName} can no longer do this delivery. It is open to other drivers again.`,
      },
    }).catch(() => {});
    if (ctx?.sender?.email) {
      emailService.sendOfferDeclined({ to: ctx.sender.email, driverName, route: ctx.route, language: ctx.sender.language });
    }
    if (ctx?.d.senderId) pushService.notifyOfferDeclined(ctx.d.senderId, driverName, id);
    console.log(`[delivery] ${id}: driver ${actorId} backed out from ${current.status}${cancelReason ? ` (${cancelReason})` : ''}`);
    return getDeliveryById(id);
  }

  // The sender calls it off before pickup. The WHERE re-asserts the state we
  // checked, and the row count decides whether money moves. Previously the
  // count was ignored: a cancel that lost a race with verify-delivery still
  // went on to refund, leaving a row that was 'delivered', paid out to the
  // driver, AND refunded to the sender — and in Stripe mode the driver's
  // transfer was reversed after they had done the job.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests
        SET status = 'cancelled'::"DeliveryStatus", "cancelledBy" = $1, "cancelReason" = $2, "updatedAt" = NOW()
      WHERE id = $3 AND status = $4::"DeliveryStatus"`,
    actorId,
    cancelReason ?? null,
    id,
    current.status,
  );
  if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');

  // Belt and braces: a captured payment means a completed delivery, and that
  // is never undone by a cancel, whatever path led here.
  const pay = await prisma.deliveryRequest.findUnique({ where: { id }, select: { paymentStatus: true } });
  if (pay?.paymentStatus === 'captured') {
    console.error(`[delivery] ${id} cancelled with a captured payment — refund skipped, needs manual review`);
  } else {
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
      -- Only parcels the sender has actually paid for. Unpaid ones used to be
      -- listed and claimable, so a driver could do the whole job for nothing.
      AND dr."paymentStatus" = 'authorised'
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
  // Pay first, then offer. A driver who is asked can only accept a paid
  // delivery, so an unpaid offer would reach them, fail when they say yes,
  // and leave the delivery parked in 'offered' and out of the open pool.
  if (delivery.paymentStatus !== 'authorised') {
    throw new AppError(400, 'Bitte bezahle die Sendung, bevor du sie anbietest');
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
  // A sender may offer before paying, but nobody may take the job until they
  // have — otherwise there is nothing to pay the driver with.
  if (delivery.paymentStatus !== 'authorised') {
    throw new AppError(400, 'Diese Sendung ist noch nicht bezahlt');
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

  const delivery = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { senderId: true, packageSize: true, packageWeight: true, paymentStatus: true },
  });
  if (!delivery) throw new AppError(404, 'Delivery not found');

  // Carrying your own parcel and paying yourself the driver's cut is not a
  // delivery. It also inflated delivery counts and CO₂ figures.
  if (delivery.senderId === driverId) {
    throw new AppError(400, 'Du kannst deine eigene Sendung nicht übernehmen');
  }
  // Nothing may be claimed before the sender has paid; otherwise the driver
  // does the job and there is no money to pay them with.
  if (delivery.paymentStatus !== 'authorised') {
    throw new AppError(400, 'Diese Sendung ist noch nicht bezahlt');
  }
  // The same capacity guards offerToRoute and the nearby list apply. Claiming
  // by id used to skip them, so an S-sized car could take an XL parcel.
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { vehicleSize: true, maxLoadKg: true },
  });
  if (driver?.vehicleSize && !sizesUpTo(driver.vehicleSize as PackageSize).includes(delivery.packageSize as PackageSize)) {
    throw new AppError(400, 'Dieses Paket passt nicht in dein Fahrzeug');
  }
  if (driver?.maxLoadKg != null && delivery.packageWeight != null && delivery.packageWeight > driver.maxLoadKg) {
    throw new AppError(400, 'Dieses Paket ist schwerer, als du laden kannst');
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

  // Compare-and-set, as on the claim paths: of two simultaneous confirms (or a
  // confirm racing a cancel) exactly one wins, and only the winner posts the
  // chat message and sends the pickup code.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests SET status = 'matched'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $1 AND status = 'requested'::"DeliveryStatus"`,
    deliveryId,
  );
  if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');

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

/** Wrong codes allowed before code entry locks, and for how long. */
const CODE_TRIES_PER_WINDOW = 5;
const CODE_LOCK_MINUTES = 15;
/** After this many wrong codes in total, entry stays locked until support resets it. */
const CODE_HARD_LIMIT = 20;

/**
 * Compare a submitted handover code, counting wrong ones.
 *
 * Six digits is a million possibilities, which is plenty only if guessing is
 * slow. It wasn't: a driver holding a parcel could keep trying delivery codes
 * limited only by the global per-IP rate limit. Now every fifth wrong code
 * locks entry for 15 minutes (at most ~480 guesses a day, years for the whole
 * space), and after 20 it stays locked and the sender is told in the chat.
 */
async function checkHandoverCode(
  deliveryId: string,
  expected: string | undefined,
  submitted: string,
  driverId: string,
  label: 'pickup' | 'delivery',
): Promise<void> {
  const lock = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { codeFailedAttempts: true, codeLockedUntil: true },
  });
  if (lock?.codeLockedUntil && lock.codeLockedUntil > new Date()) {
    throw new AppError(429, 'Zu viele falsche Codes. Die Code-Eingabe ist vorübergehend gesperrt.');
  }
  if (expected && submitted === expected) return;

  // Count atomically: parallel wrong guesses must each be counted.
  const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `UPDATE delivery_requests SET "codeFailedAttempts" = "codeFailedAttempts" + 1
      WHERE id = $1 RETURNING "codeFailedAttempts" AS n`,
    deliveryId,
  );
  if (n >= CODE_HARD_LIMIT || n % CODE_TRIES_PER_WINDOW === 0) {
    const until = n >= CODE_HARD_LIMIT
      ? new Date('9999-12-31T00:00:00Z')
      : new Date(Date.now() + CODE_LOCK_MINUTES * 60_000);
    await prisma.deliveryRequest.update({ where: { id: deliveryId }, data: { codeLockedUntil: until } });
    console.warn(`[delivery] ${deliveryId}: ${n} wrong ${label} codes, entry locked until ${until.toISOString()}`);
    // The sender should know someone is guessing at their parcel's code.
    await prisma.message.create({
      data: {
        deliveryRequestId: deliveryId,
        senderId: driverId,
        content: n >= CODE_HARD_LIMIT
          ? 'Too many wrong codes were entered for this delivery. Code entry is locked; please contact support.'
          : `Several wrong ${label} codes were entered. Code entry is paused for ${CODE_LOCK_MINUTES} minutes.`,
      },
    }).catch(() => {});
    throw new AppError(429, 'Zu viele falsche Codes. Die Code-Eingabe ist vorübergehend gesperrt.');
  }
  throw new AppError(400, label === 'pickup' ? 'Invalid pickup code' : 'Invalid delivery code');
}

export async function verifyPickup(deliveryId: string, driverId: string, code: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.driverId !== driverId) throw new AppError(403, 'Not authorized');
  if (delivery.status !== 'accepted') throw new AppError(400, 'Delivery is not in accepted state');
  // Collecting a parcel nobody has paid for means a job with no money behind it.
  if (delivery.paymentStatus !== 'authorised') {
    throw new AppError(400, 'Diese Sendung ist noch nicht bezahlt');
  }
  await checkHandoverCode(deliveryId, delivery.pickupCode, code, driverId, 'pickup');

  // Move to in_transit (skipping picked_up since both parties confirmed via code).
  // Compare-and-set so a double tap sends the recipient one SMS, not two.
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests SET status = 'in_transit'::"DeliveryStatus",
            "codeFailedAttempts" = 0, "codeLockedUntil" = NULL, "updatedAt" = NOW()
      WHERE id = $1 AND status = 'accepted'::"DeliveryStatus" AND "driverId" = $2`,
    deliveryId,
    driverId,
  );
  if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');

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
  await checkHandoverCode(deliveryId, delivery.deliveryCode, code, driverId, 'delivery');

  // ── Impact ──────────────────────────────────────────────────────
  // Computed before anything is written: it only reads, and the write below
  // must be a single all-or-nothing step.
  //
  // The saving is measured against what would otherwise have happened,
  // marginally on both sides — see computeCo2Saved in @peerdeliver/shared for
  // the full reasoning. In short: the old figure here was distance × 0.12,
  // which assumed the alternative was a dedicated car trip and that our own
  // trip was free. For anything the post would have carried, both assumptions
  // are wrong, and the honest transport saving is usually zero.
  const [{ km }] = await prisma.$queryRawUnsafe<{ km: number }[]>(
    `SELECT ST_Distance(dr."pickupPoint"::geography, dr."deliveryPoint"::geography) / 1000 AS km
       FROM delivery_requests dr WHERE dr.id = $1`,
    deliveryId,
  );

  const row = await prisma.deliveryRequest.findUnique({
    where: { id: deliveryId },
    select: { packaging: true, packageSize: true },
  });

  // Where this came from a driver's published route, the detour is knowable
  // rather than assumed: how much further they drove than they would have.
  let measuredDetourKm: number | undefined;
  if (delivery.driverId) {
    try {
      const rows = await prisma.$queryRawUnsafe<{ detour: number }[]>(
        `SELECT (
             ST_Distance(r."originPoint"::geography, d."pickupPoint"::geography)
           + ST_Distance(d."pickupPoint"::geography, d."deliveryPoint"::geography)
           + ST_Distance(d."deliveryPoint"::geography, r."destinationPoint"::geography)
           - ST_Distance(r."originPoint"::geography, r."destinationPoint"::geography)
         ) / 1000 AS detour
         FROM delivery_requests d
         JOIN driver_routes r ON r."driverId" = d."driverId"
        WHERE d.id = $1 AND r."isActive" = true
        ORDER BY detour ASC
        LIMIT 1`,
        deliveryId,
      );
      if (rows[0]?.detour != null && rows[0].detour >= 0) measuredDetourKm = rows[0].detour;
    } catch {
      // Fall back to the assumed fraction; an impact figure must never break a
      // delivery completing.
    }
  }

  const impact = computeCo2Saved({
    distanceKm: km || 0,
    size: (row?.packageSize ?? 'M') as PackageSize,
    packaging: row?.packaging ?? null,
    detourKm: measuredDetourKm,
  });
  const co2SavedKg = impact.savedKg;

  // ── Status + stats, once ────────────────────────────────────────
  //
  // One transaction, and a compare-and-set on the status inside it. The old
  // code read the status, then wrote unconditionally in seven separate
  // statements: ten simultaneous verify-delivery calls (a double tap, a client
  // retry) credited the driver ten deliveries and ten times the CO₂, and
  // re-ran the capture five times. Now exactly one call moves the delivery to
  // 'delivered' and credits the stats; the others get 409 and do nothing. A
  // crash part-way leaves nothing half-written.
  await prisma.$transaction(async (tx) => {
    const applied = await tx.$executeRawUnsafe(
      `UPDATE delivery_requests
          SET status = 'delivered'::"DeliveryStatus", "co2SavedKg" = $3, "updatedAt" = NOW()
        WHERE id = $1 AND status = 'in_transit'::"DeliveryStatus" AND "driverId" = $2`,
      deliveryId,
      driverId,
      co2SavedKg,
    );
    if (applied === 0) throw new AppError(409, 'Diese Lieferung wurde bereits abgeschlossen');
    // Credit both parties' lifetime impact; the driver also gets a completed delivery.
    await tx.user.update({
      where: { id: driverId },
      data: { co2Saved: { increment: co2SavedKg }, totalDeliveries: { increment: 1 } },
    });
    if (delivery.senderId) {
      await tx.user.update({
        where: { id: delivery.senderId },
        data: { co2Saved: { increment: co2SavedKg } },
      });
    }
  });

  await prisma.message.create({
    data: {
      deliveryRequestId: deliveryId,
      senderId: driverId,
      content: 'Package delivered successfully!',
    },
  });

  /**
   * Split the budget and credit the driver. No-op if the sender never paid.
   *
   * A failed payout must not fail the handover. The parcel HAS been delivered
   * and the recipient HAS confirmed it with their code; those facts are
   * already written. Letting a Stripe error propagate turned all of that into
   * "500 Internal server error" on the driver's phone — which reads as "the
   * delivery didn't go through", and invites them to try again on a delivery
   * that is already complete.
   *
   * So the two outcomes are separated: the delivery is delivered either way,
   * and the payout is reported alongside it. An unpaid one stays `authorised`
   * with the split recorded, and npm run payout:retry pays it.
   */
  let payout: { ok: boolean; reason?: string } = { ok: true };
  try {
    await paymentService.captureAndPayoutOnDelivered(deliveryId);
    // captureAndPayoutOnDelivered returns quietly when there was nothing to
    // capture. "ok" must mean money moved, not merely that nothing threw —
    // the driver of an unpaid delivery used to be told their payout worked.
    const after = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { paymentStatus: true },
    });
    if (after?.paymentStatus !== 'captured') {
      payout = { ok: false, reason: 'unpaid' };
    }
  } catch (err) {
    const reason = (err as Error).message;
    console.error(`[delivery] ${deliveryId} delivered, payout failed: ${reason}`);
    payout = { ok: false, reason };
  }

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
    // Only promise the driver money that actually moved.
    if (ctx.d.driverId && payout.ok) {
      const split = paymentService.computeSplit(ctx.d.budgetCHF);
      pushService.notifyDriverPayout(ctx.d.driverId, split.driverPayoutCHF, deliveryId);
    }
  }

  // The payout outcome travels with the delivery rather than only into the
  // logs. The driver's app can tell them the money is on its way or that it
  // is pending, and a test can say which failure occurred instead of "500".
  const result = await getDeliveryById(deliveryId);
  return { ...result, payout };
}

export async function rejectDriver(deliveryId: string, senderId: string) {
  const delivery = await getDeliveryById(deliveryId);
  if (!delivery || delivery.senderId !== senderId) {
    throw new AppError(403, 'Not authorized');
  }

  // Rejecting is turning down a driver's *request*, nothing more. It used to
  // work in any state: a sender could "reject" the driver of a delivered
  // parcel, which unassigned them and reopened the delivery, then cancel it
  // for a full refund — keeping the parcel and the money, while in Stripe mode
  // the driver's transfer was reversed.
  if (delivery.status !== 'requested') {
    throw new AppError(400, 'Nur eine offene Anfrage kann abgelehnt werden');
  }

  // Reset to pending so other drivers can request
  const applied = await prisma.$executeRawUnsafe(
    `UPDATE delivery_requests SET "driverId" = NULL, status = 'pending'::"DeliveryStatus", "updatedAt" = NOW()
      WHERE id = $1 AND status = 'requested'::"DeliveryStatus"`,
    deliveryId,
  );
  if (applied === 0) throw new AppError(409, 'Diese Lieferung hat sich inzwischen geändert');

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
