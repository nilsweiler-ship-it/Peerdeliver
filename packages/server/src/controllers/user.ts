import { Request, Response, NextFunction } from 'express';
import { userService } from '../services';
import { success } from '../utils';

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
