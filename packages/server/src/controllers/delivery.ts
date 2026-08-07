import { Request, Response, NextFunction } from 'express';
import { deliveryService, userService } from '../services';
import { success, error } from '../utils';
import { getIO } from '../socket';
import { publishDriverLocation } from '../socket/trackingHandler';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.createDelivery(req.user!.userId, req.body);
    success(res, delivery, 201);
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

    success(res, deliveries);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    if (!delivery) {
      error(res, 'Delivery not found', 404);
      return;
    }
    success(res, delivery);
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
    success(res, delivery);
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
    success(res, deliveries);
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.assignDelivery(req.params.id, req.user!.userId);
    success(res, delivery);
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
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

/** The offered driver accepts. */
export async function acceptOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.acceptOffer(req.params.id, req.user!.userId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

/** Sender takes back an offer nobody answered. */
export async function withdrawOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.withdrawOffer(req.params.id, req.user!.userId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

/** The offered driver declines; the delivery returns to the open pool. */
export async function declineOffer(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.declineOffer(req.params.id, req.user!.userId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.confirmDelivery(req.params.id, req.user!.userId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.rejectDriver(req.params.id, req.user!.userId);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function verifyPickup(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.verifyPickup(req.params.id, req.user!.userId, req.body.code);
    success(res, delivery);
  } catch (err) {
    next(err);
  }
}

export async function verifyDelivery(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.verifyDelivery(req.params.id, req.user!.userId, req.body.code);
    success(res, delivery);
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
