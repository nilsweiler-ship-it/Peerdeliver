import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          // The first problem, worded so the app can show it as is ("Bitte
          // runde den Betrag auf 5 Rappen.") instead of "Validation failed".
          // Messages written for people end with a full stop; zod's own
          // ("Required", "Invalid email") don't, and get their field name.
          error: (() => {
            const first = err.errors[0];
            if (!first) return 'Validation failed';
            return first.message.trim().endsWith('.')
              ? first.message
              : `${first.path.join('.') || 'input'}: ${first.message}`;
          })(),
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
