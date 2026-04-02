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
    const { firstName, lastName, phone, bio, language } = req.body;
    const user = await userService.updateProfile(req.user!.userId, {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(language !== undefined && { language }),
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
