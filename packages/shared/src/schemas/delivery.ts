import { z } from 'zod';

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const addressSchema = z.object({
  label: z.string().min(1),
  point: geoPointSchema,
});

export const createDeliverySchema = z.object({
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  recipientEmail: z.string().email().optional(),
  packageSize: z.enum(['S', 'M', 'L']),
  packageWeight: z.number().positive().optional(),
  packageDescription: z.string().max(500).optional(),
  packaging: z.enum(['none', 'reused', 'cardboard', 'other']).optional(),
  declaredValue: z.number().nonnegative().optional(),
  budgetCHF: z.number().positive(),
  deliveryWindowStart: z.string().datetime(),
  deliveryWindowEnd: z.string().datetime(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum([
    'requested',
    'matched',
    'accepted',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled',
  ]),
  cancelReason: z.string().max(500).optional(),
});

export const verifyCodeSchema = z.object({
  code: z.string().length(6),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
