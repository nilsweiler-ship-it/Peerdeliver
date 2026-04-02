import { Request, Response, NextFunction } from 'express';
import { deliveryService } from '../services';
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
    const deliveries =
      role === 'driver'
        ? await deliveryService.getDeliveriesByDriver(req.user!.userId)
        : await deliveryService.getDeliveriesBySender(req.user!.userId);
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
