import { Request, Response, NextFunction } from 'express';
import { deliveryService, userService, lifecycleService } from '../services';
import { success, error } from '../utils';
import { getIO } from '../socket';
import { publishDriverLocation } from '../socket/trackingHandler';

/**
 * Every delivery that leaves this controller goes through here, so the
 * handover codes only ever reach the person entitled to each one. See
 * redactForViewer for the rules and why they matter.
 */
function viewerOf(req: Request, email?: string | null): deliveryService.DeliveryViewer {
  return { userId: req.user!.userId, email: email ?? null };
}

function sendDelivery(res: Response, req: Request, delivery: Record<string, unknown> | null, status = 200) {
  success(res, delivery ? deliveryService.redactForViewer(delivery, viewerOf(req)) : delivery, status);
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.createDelivery(req.user!.userId, req.body);
    sendDelivery(res, req, delivery, 201);
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.user!.role;
    const userId = req.user!.userId;
    const { email } = await userService.getUserById(userId);

    // Receiving is not an opt-in role: anyone can be named as the recipient of
    // a parcel, so incoming deliveries are always included. Previously a 'both'
    // user got sent + driven only, and a parcel addressed to them was invisible
    // in the app — which is the common case now that 'both' is the default.
    const wants = {
      // Sending is open to everyone; only an explicit driver-only role opts out.
      sent: role !== 'driver',
      // Driving needs a vehicle and a verified plate, so it is the one thing a
      // user genuinely opts into.
      driven: role !== 'sender' && role !== 'recipient',
      received: true,
    };

    const [sent, driven, received] = await Promise.all([
      wants.sent ? deliveryService.getDeliveriesBySender(userId) : [],
      wants.driven ? deliveryService.getDeliveriesByDriver(userId) : [],
      wants.received ? deliveryService.getDeliveriesByRecipient(userId, email) : [],
    ]);

    // Merge newest-first, dedup by id — a user can be both sender and recipient
    // on the same delivery (sending something to themselves at another address).
    const seen = new Set<string>();
    const deliveries = [...sent, ...driven, ...received]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });

    const viewer = viewerOf(req, email);
    success(res, deliveries.map((d) => deliveryService.redactForViewer(d, viewer)));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    // Only the sender, the driver and the recipient may see a delivery. Any
    // signed-in account used to be able to read any delivery by id — home
    // addresses, the recipient's phone and email, payment references and both
    // handover codes. A stranger gets the same 404 as for a missing id, so the
    // endpoint does not confirm which ids exist.
    const { email } = await userService.getUserById(req.user!.userId);
    const viewer = viewerOf(req, email);
    if (!delivery || !deliveryService.isParticipantView(delivery, viewer)) {
      error(res, 'Delivery not found', 404);
      return;
    }
    success(res, deliveryService.redactForViewer(delivery, viewer));
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.updateDeliveryStatus(
      req.params.id,
      req.body.status,
      req.body.cancelReason ? req.user!.userId : undefined,
      req.body.cancelReason,
      req.user!.userId,
    );
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

export async function getNearby(req: Request, res: Response, next: NextFunction) {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 50;

    if (isNaN(lat) || isNaN(lng)) {
      error(res, 'lat and lng query parameters are required', 400);
      return;
    }

    // Only surface deliveries the requesting driver's vehicle can carry.
    const driver = await userService.getUserById(req.user!.userId);
    const deliveries = await deliveryService.getNearbyDeliveries(lat, lng, radius, {
      vehicleSize: (driver as any).vehicleSize,
      maxLoadKg: (driver as any).maxLoadKg,
    });
    // Browsing drivers are not participants in any of these: no codes, ever.
    success(res, deliveries.map((d) => deliveryService.redactForViewer(d, viewerOf(req))));
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.assignDelivery(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

/** Sender offers this delivery to one driver's published route. */
export async function offerRoute(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { routeId } = req.body as { routeId?: string };
    if (!routeId) {
      error(res, 'routeId is required', 400);
      return;
    }
    const delivery = await deliveryService.offerToRoute(req.params.id, req.user!.userId, routeId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

/** The offered driver accepts. */
export async function acceptOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.acceptOffer(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

/** Sender takes back an offer nobody answered. */
export async function withdrawOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.withdrawOffer(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

/** The offered driver declines; the delivery returns to the open pool. */
export async function declineOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.declineOffer(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.confirmDelivery(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.rejectDriver(req.params.id, req.user!.userId);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

export async function verifyPickup(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.verifyPickup(req.params.id, req.user!.userId, req.body.code);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

export async function verifyDelivery(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.verifyDelivery(req.params.id, req.user!.userId, req.body.code);
    sendDelivery(res, req, delivery);
  } catch (err) {
    next(err);
  }
}

/**
 * Location report from the driver's OS background task.
 *
 * The background task runs in its own JS context with no socket, so it can only
 * speak HTTP. Authorisation and fan-out are shared with the socket path in
 * publishDriverLocation.
 */
export async function reportLocation(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.body ?? {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      error(res, 'Invalid coordinates', 400);
      return;
    }
    const io = getIO();
    if (!io) {
      // Nothing to broadcast to. Not the client's problem — ack so the OS task
      // doesn't treat it as a failure and back off.
      success(res, { delivered: false });
      return;
    }
    const ok = await publishDriverLocation(io, req.params.id, req.user!.userId, lat, lng);
    if (!ok) {
      error(res, 'Not the assigned driver, or delivery is not in progress', 403);
      return;
    }
    success(res, { delivered: true });
  } catch (err) {
    next(err);
  }
}

export async function getDriverInfo(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    if (!delivery || !delivery.driverId) {
      error(res, 'No driver assigned', 404);
      return;
    }

    // Only the people involved may see the driver's name, car and plate. Being
    // logged in is not enough — anyone holding a delivery id could otherwise
    // pull a named person's vehicle details.
    const userId = req.user?.userId;
    const participants = [delivery.senderId, delivery.driverId, delivery.recipientId];
    if (!userId || !participants.includes(userId)) {
      error(res, 'Not authorised', 403);
      return;
    }

    const prisma = require('../config').prisma;
    const driver = await prisma.user.findUnique({
      where: { id: delivery.driverId },
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        averageRating: true, totalRatings: true, totalDeliveries: true,
        carModel: true, licensePlate: true, maxLoadKg: true, shareLocation: true,
      },
    });
    success(res, driver);
  } catch (err) {
    next(err);
  }
}

/** Report a problem with a delivery (sender, driver or recipient). */
export async function dispute(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { email } = await userService.getUserById(req.user!.userId);
    const result = await lifecycleService.openDispute(
      req.params.id,
      { userId: req.user!.userId, email },
      (req.body as { reason?: string })?.reason ?? '',
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
}

/** Rate the other side of a delivered delivery. */
export async function rate(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const { email } = await userService.getUserById(req.user!.userId);
    const { score, comment } = (req.body ?? {}) as { score?: number; comment?: string };
    const rating = await lifecycleService.rateDelivery(
      req.params.id,
      { userId: req.user!.userId, email },
      Number(score),
      comment,
    );
    success(res, rating, 201);
  } catch (err) {
    next(err);
  }
}

/** The caller's own rating for this delivery, or null. */
export async function myRating(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    success(res, await lifecycleService.getMyRating(req.params.id, req.user!.userId));
  } catch (err) {
    next(err);
  }
}
