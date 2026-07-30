import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config';
import { emailService } from '../services';

/**
 * Public form endpoints for the marketing site (waitlist + Kontakt).
 *
 * Two design rules here:
 *
 * 1. **The database is the record, email is a convenience.** We persist first,
 *    then fire the notification. If Resend is down we still have the lead —
 *    the previous formsubmit.co setup lost anything that didn't arrive by mail.
 *
 * 2. **Never leak whether an address is already known.** A repeat signup is an
 *    upsert returning the same success response, so the endpoint can't be used
 *    to enumerate who has signed up.
 *
 * These routes are unauthenticated by necessity, so they carry a honeypot field
 * and a tight rate limit (see routes/forms.ts).
 */

/** Shared spam trap: bots fill every field they find, humans never see this one. */
const honeypot = z.string().max(0).optional();

const waitlistSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(['sender', 'driver', 'both']).optional(),
  language: z.string().max(5).optional(),
  source: z.string().max(40).optional(),
  routeHint: z.string().max(300).optional(),
  company: honeypot, // honeypot
});

const contactSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().max(200),
  topic: z.string().max(80).optional(),
  message: z.string().min(1).max(5000),
  language: z.string().max(5).optional(),
  company: honeypot, // honeypot
});

/** Bots that trip the honeypot get a normal-looking success and are dropped. */
function silentOk(res: Response) {
  return res.status(200).json({ success: true });
}

export async function waitlist(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = waitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid submission' });
    }
    const { company, ...data } = parsed.data;
    if (company) return silentOk(res);

    const email = data.email.trim().toLowerCase();
    const language = data.language || 'de';

    const record = await prisma.waitlistSignup.upsert({
      where: { email },
      // A returning visitor may pick a different role or come from a new source;
      // keep the newest intent but never create a duplicate row.
      update: {
        role: data.role ?? undefined,
        language,
        source: data.source ?? undefined,
        routeHint: data.routeHint ?? undefined,
      },
      create: {
        email,
        role: data.role,
        language,
        source: data.source || 'website',
        routeHint: data.routeHint,
      },
    });

    const total = await prisma.waitlistSignup.count();

    emailService.sendInternal({
      subject: `Neue Anmeldung: ${email}`,
      replyTo: email,
      lines: {
        'E-Mail': email,
        Rolle: data.role || '—',
        Sprache: language,
        Quelle: data.source || 'website',
        Strecke: data.routeHint || '—',
        'Total Anmeldungen': total,
      },
    });

    return res.status(201).json({ success: true, data: { id: record.id } });
  } catch (err) {
    return next(err);
  }
}

export async function contact(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid submission' });
    }
    const { company, ...data } = parsed.data;
    if (company) return silentOk(res);

    const email = data.email.trim().toLowerCase();

    const record = await prisma.contactMessage.create({
      data: {
        name: data.name,
        email,
        topic: data.topic,
        message: data.message,
        language: data.language || 'de',
      },
    });

    emailService.sendInternal({
      subject: `Kontakt: ${data.topic || 'Allgemein'} — ${data.name || email}`,
      replyTo: email,
      lines: {
        Name: data.name || '—',
        'E-Mail': email,
        Thema: data.topic || '—',
        Sprache: data.language || 'de',
        Nachricht: data.message,
      },
    });

    return res.status(201).json({ success: true, data: { id: record.id } });
  } catch (err) {
    return next(err);
  }
}
