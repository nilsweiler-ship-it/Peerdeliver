import { Request, Response, NextFunction } from 'express';
import { resolvePartner } from '../services/partner';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      partnerName?: string;
    }
  }
}

/**
 * Partner API key check.
 *
 * The key is publishable (it ships in a marketplace's front-end widget), so it
 * only ever unlocks read-only quotes — never delivery creation or user data.
 * Accepts `X-Shlep-Key` header or `?key=` for simple <script> embeds.
 */
export function partnerAuth(req: Request, res: Response, next: NextFunction): void {
  const key =
    (req.header('x-shlep-key') || '').trim() ||
    (typeof req.query.key === 'string' ? req.query.key.trim() : '');

  if (!key) {
    res.status(401).json({ success: false, error: 'Missing partner API key' });
    return;
  }

  const partner = resolvePartner(key);
  if (!partner) {
    res.status(403).json({ success: false, error: 'Invalid partner API key' });
    return;
  }

  req.partnerName = partner;
  next();
}
