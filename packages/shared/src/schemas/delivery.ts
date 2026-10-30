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
  // Required, not optional: the recipient's address is what creates their
  // account and pulls them into the product. Enforced here as well as in the
  // form, because a client-side rule is a suggestion, not a requirement.
  recipientEmail: z.string().email(),
  recipientPhone: z.string().min(6).max(25).optional(),
  // XL = beyond Swiss Post's Sperrgut ceiling; no postal alternative exists.
  packageSize: z.enum(['S', 'M', 'L', 'XL']),
  packageWeight: z.number().positive().optional(),
  packageDescription: z.string().max(500).optional(),
  packaging: z.enum(['none', 'reused', 'cardboard', 'other']).optional(),
  declaredValue: z.number().nonnegative().optional(),
  budgetCHF: z.number().positive(),
  deliveryWindowStart: z.string().datetime(),
  deliveryWindowEnd: z.string().datetime(),
});

/**
 * The generic status endpoint only accepts the two moves that need no proof.
 * picked_up / in_transit / delivered go through verify-pickup and
 * verify-delivery, which demand the handover codes; requested / matched go
 * through assign and confirm. Accepting them here let a driver mark a parcel
 * delivered with no code at all.
 */
export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['accepted', 'cancelled']),
  cancelReason: z.string().max(500).optional(),
});

export const verifyCodeSchema = z.object({
  code: z.string().length(6),
});

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
