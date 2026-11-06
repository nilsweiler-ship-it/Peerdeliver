import { Request, Response, NextFunction } from 'express';
import { localize, requestLang } from '../i18n/messages';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    /** Stable, machine-readable reason the app can act on (e.g. open the verification screen). */
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error & { type?: string }, req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message, err.stack);

  if (err instanceof AppError) {
    // In the language the app asked for (see i18n/messages.ts).
    const message = localize(err.message, requestLang(req.headers['accept-language']));
    res.status(err.statusCode).json({ success: false, error: message, ...(err.code ? { code: err.code } : {}) });
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
