import { Request, Response, NextFunction } from 'express';
import { routeService } from '../services';
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

export async function toggleActive(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const route = await routeService.toggleRouteActive(req.params.id, req.body.isActive);
    success(res, route);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
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
