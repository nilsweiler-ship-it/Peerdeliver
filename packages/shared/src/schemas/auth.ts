import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['sender', 'driver', 'both', 'recipient']),
  phone: z.string().optional(),
  // Italian too: the app and every email template speak it, but sign-up
  // refused 'it' and the app quietly sent Ticino users English instead.
  language: z.enum(['en', 'de', 'fr', 'it']).default('en'),
  licensePlate: z.string().max(10).optional(),
  carModel: z.string().max(100).optional(),
  maxLoadKg: z.number().positive().optional(),
  vehicleSize: z.enum(['S', 'M', 'L', 'XL']).optional(),
});

/**
 * What a user may change about themselves. Unknown fields are dropped, and
 * each value is checked: an unvalidated update used to store a language of
 * 'klingon' and turn a negative load into a 500 with Prisma internals.
 * `role` is limited to the self-service roles; never 'admin'.
 */
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(25).optional(),
  bio: z.string().max(500).optional(),
  language: z.enum(['en', 'de', 'fr', 'it']).optional(),
  role: z.enum(['sender', 'driver', 'both', 'recipient']).optional(),
  shareLocation: z.boolean().optional(),
  licensePlate: z.string().trim().max(10).nullable().optional(),
  carModel: z.string().trim().max(100).nullable().optional(),
  maxLoadKg: z.number().positive().max(2000).nullable().optional(),
  vehicleSize: z.enum(['S', 'M', 'L', 'XL']).nullable().optional(),
});

/** A chat message: not empty, not a novel. */
export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Die Nachricht ist leer.').max(2000, 'Die Nachricht ist zu lang (höchstens 2000 Zeichen).'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
