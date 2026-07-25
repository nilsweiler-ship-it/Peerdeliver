import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as partnerService from '../services/partner';
import { success } from '../utils';
import { AppError } from '../middleware';

export const quoteSchema = z.object({
  fromLat: z.number().min(45).max(48), // Switzerland bounding box
  fromLng: z.number().min(5).max(11),
  toLat: z.number().min(45).max(48),
  toLng: z.number().min(5).max(11),
  size: z.enum(['small', 'medium', 'large']).optional(),
  declaredValueCHF: z.number().positive().max(100000).optional(),
});

export async function quote(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid quote request: ' + parsed.error.errors.map((e) => e.path.join('.')).join(', '));
    }
    const result = await partnerService.quote(parsed.data);
    success(res, result);
  } catch (err) {
    next(err);
  }
}
