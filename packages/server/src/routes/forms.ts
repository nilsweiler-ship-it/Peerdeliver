import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as formsController from '../controllers/forms';

const router = Router();

/**
 * Called from the static site on shlep.ch (a different origin from the API),
 * so CORS has to be open. There is no API key here by design — these are public
 * forms; abuse is handled by the rate limit and the honeypot, not by a secret
 * that would sit in plain sight in the page source anyway.
 */
const formsCors = cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
});

/**
 * Deliberately tight: a human submits a form a handful of times at most.
 * Generous enough that an office behind one NAT address won't get blocked.
 */
const formsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, error: 'Too many submissions, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.options('/waitlist', formsCors);
router.post('/waitlist', formsCors, formsLimiter, formsController.waitlist);

router.options('/contact', formsCors);
router.post('/contact', formsCors, formsLimiter, formsController.contact);

export default router;
