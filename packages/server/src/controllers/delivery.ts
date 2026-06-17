import { Request, Response, NextFunction } from 'express';
import { deliveryService, userService } from '../services';
import { success, error } from '../utils';

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
    let deliveries;
    if (role === 'both') {
      const [sent, driven] = await Promise.all([
        deliveryService.getDeliveriesBySender(userId),
        deliveryService.getDeliveriesByDriver(userId),
      ]);
      // Merge and sort by createdAt desc, dedup by id
      const seen = new Set<string>();
      deliveries = [...sent, ...driven]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .filter((d) => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
    } else if (role === 'driver') {
      deliveries = await deliveryService.getDeliveriesByDriver(userId);
    } else if (role === 'recipient') {
      const { email } = await userService.getUserById(userId);
      deliveries = await deliveryService.getDeliveriesByRecipient(userId, email);
    } else {
      deliveries = await deliveryService.getDeliveriesBySender(userId);
    }
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

    const deliveries = await deliveryService.getNearbyDeliveries(lat, lng, radius);
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

export async function getDriverInfo(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    if (!delivery || !delivery.driverId) {
      error(res, 'No driver assigned', 404);
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
