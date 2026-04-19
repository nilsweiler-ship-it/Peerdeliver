import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  // Handle JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ success: false, error: 'Invalid JSON' });
    return;
  }

  const detail = process.env.NODE_ENV !== 'production' ? err.message : 'Internal server error';
  res.status(500).json({ success: false, error: detail });
}
