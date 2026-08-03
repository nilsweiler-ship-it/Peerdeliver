import { Request, Response, NextFunction } from 'express';
import { userService, pushService } from '../services';
import { success, error } from '../utils';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.getUserById(req.user!.userId);
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, phone, bio, language, role, shareLocation, licensePlate, carModel, maxLoadKg, vehicleSize } = req.body;
    const user = await userService.updateProfile(req.user!.userId, {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(language !== undefined && { language }),
      ...(role !== undefined && { role }),
      ...(shareLocation !== undefined && { shareLocation }),
      ...(licensePlate !== undefined && { licensePlate }),
      ...(carModel !== undefined && { carModel }),
      ...(maxLoadKg !== undefined && { maxLoadKg }),
      ...(vehicleSize !== undefined && { vehicleSize }),
    });
    success(res, user);
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    await userService.deleteAccount(req.user!.userId);
    success(res, { message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * Store the device's Expo push token.
 *
 * Called after the app obtains permission. Idempotent — the app re-registers on
 * every launch because Expo can rotate a token at any time.
 */
export async function registerPushToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      error(res, 'Missing token', 400);
      return;
    }
    const ok = await pushService.registerToken(req.user!.userId, token);
    if (!ok) {
      error(res, 'Invalid Expo push token', 400);
      return;
    }
    success(res, { registered: true });
  } catch (err) {
    next(err);
  }
}

/** Forget the device token, e.g. on logout. */
export async function unregisterPushToken(req: Request, res: Response, next: NextFunction) {
  try {
    await pushService.clearToken(req.user!.userId);
    success(res, { registered: false });
  } catch (err) {
    next(err);
  }
}
