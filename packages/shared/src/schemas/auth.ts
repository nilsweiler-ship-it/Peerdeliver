import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['sender', 'driver', 'both', 'recipient']),
  phone: z.string().optional(),
  language: z.enum(['en', 'de', 'fr']).default('en'),
  licensePlate: z.string().max(10).optional(),
  carModel: z.string().max(100).optional(),
  maxLoadKg: z.number().positive().optional(),
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
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
