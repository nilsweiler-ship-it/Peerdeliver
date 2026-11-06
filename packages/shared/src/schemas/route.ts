import { z } from 'zod';

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const routeFields = z.object({
  originAddress: z.string().min(1),
  originPoint: geoPointSchema,
  destinationAddress: z.string().min(1),
  destinationPoint: geoPointSchema,
  routeType: z.enum(['one_time', 'recurring']),
  departureTime: z.string().datetime({ offset: true }),
  recurringDays: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .optional(),
  // XL = a van or estate car that can take what Post refuses (>30 kg / >200 cm).
  availableSize: z.enum(['S', 'M', 'L', 'XL']),
  maxDetourMinutes: z.number().int().min(0).max(60).default(15),
});

export const createRouteSchema = routeFields.superRefine((r, ctx) => {
  // A one-off trip that has already left can carry nothing. (A recurring
  // route's first departure may be in the past; it repeats.)
  if (r.routeType === 'one_time' && Date.parse(r.departureTime) < Date.now() - 60 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departureTime'], message: 'Diese Abfahrt liegt in der Vergangenheit.' });
  }
  // "Recurring" with no days recurs never.
  if (r.routeType === 'recurring' && !(r.recurringDays && r.recurringDays.length)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recurringDays'], message: 'Wähle mindestens einen Wochentag.' });
  }
});

export const updateRouteSchema = routeFields.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
