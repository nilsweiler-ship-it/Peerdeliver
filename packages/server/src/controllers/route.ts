import { Request, Response, NextFunction } from 'express';
import { routeService, deliveryService } from '../services';
import { prisma } from '../config';
import { success, error } from '../utils';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    // Vehicle details are no longer collected at signup — everyone starts with
    // both roles, and most people send before they ever drive. Publishing a
    // route is the first moment the vehicle actually matters: senders are shown
    // the plate, and capacity matching depends on the size.
    const driver = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { licensePlate: true, vehicleSize: true },
    });
    if (!driver?.licensePlate || !driver?.vehicleSize) {
      error(
        res,
        'Bitte ergänze zuerst dein Fahrzeug (Kennzeichen und Grösse) in deinem Profil.',
        400,
      );
      return;
    }

    const route = await routeService.createRoute(req.user!.userId, req.body);
    success(res, route, 201);
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const routes = await routeService.getRoutesByDriver(req.user!.userId);
    success(res, routes);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const route = await routeService.getRouteById(req.params.id);
    if (!route) {
      error(res, 'Route not found', 404);
      return;
    }
    success(res, route);
  } catch (err) {
    next(err);
  }
}

/**
 * Both mutations below are keyed only on a route id, which the client supplies.
 * Without an ownership check any signed-in driver could deactivate or delete
 * any other driver's published route — and, now that routes can carry open
 * offers, strand somebody else's delivery in the process.
 */
async function assertOwnsRoute(routeId: string, userId: string): Promise<boolean> {
  const route = await prisma.driverRoute.findUnique({
    where: { id: routeId },
    select: { driverId: true },
  });
  return !!route && route.driverId === userId;
}

export async function toggleActive(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    if (!(await assertOwnsRoute(req.params.id, req.user!.userId))) {
      error(res, 'Not authorized', 403);
      return;
    }
    const route = await routeService.toggleRouteActive(req.params.id, req.body.isActive);
    // A deactivated route can no longer honour an offer made against it.
    if (req.body.isActive === false) {
      await deliveryService.reopenOffersForRoute(req.params.id);
    }
    success(res, route);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    if (!(await assertOwnsRoute(req.params.id, req.user!.userId))) {
      error(res, 'Not authorized', 403);
      return;
    }
    // Return open offers to the pool before the route disappears, otherwise the
    // sender's delivery is left assigned to a route that no longer exists and
    // invisible to every other driver.
    await deliveryService.reopenOffersForRoute(req.params.id);
    await routeService.deleteRoute(req.params.id);
    success(res, { message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const fromLat = parseFloat(req.query.fromLat as string);
    const fromLng = parseFloat(req.query.fromLng as string);
    const toLat = parseFloat(req.query.toLat as string);
    const toLng = parseFloat(req.query.toLng as string);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      error(res, 'fromLat, fromLng, toLat, toLng query parameters are required', 400);
      return;
    }

    const routes = await routeService.searchRoutes(fromLat, fromLng, toLat, toLng);
    success(res, routes);
  } catch (err) {
    next(err);
  }
}
