import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as partnerController from '../controllers/partner';
import { partnerAuth } from '../middleware/partnerAuth';

const router = Router();

/**
 * Partner endpoints are called from marketplace front-ends, so they need open
 * CORS (the API key, not the origin, is the gate) and their own rate limit.
 */
const partnerCors = cors({ origin: '*', methods: ['POST', 'GET', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-Shlep-Key'] });

const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { success: false, error: 'Quote rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.options('/quote', partnerCors);
router.post('/quote', partnerCors, quoteLimiter, partnerAuth, partnerController.quote);

export default router;
