import { z } from 'zod';

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createRouteSchema = z.object({
  originAddress: z.string().min(1),
  originPoint: geoPointSchema,
  destinationAddress: z.string().min(1),
  destinationPoint: geoPointSchema,
  routeType: z.enum(['one_time', 'recurring']),
  departureTime: z.string().datetime(),
  recurringDays: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .optional(),
  // XL = a van or estate car that can take what Post refuses (>30 kg / >200 cm).
  availableSize: z.enum(['S', 'M', 'L', 'XL']),
  maxDetourMinutes: z.number().int().min(0).max(60).default(15),
});

export const updateRouteSchema = createRouteSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
