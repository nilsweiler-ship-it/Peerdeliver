import { z } from 'zod';

export const createRatingSchema = z.object({
  deliveryRequestId: z.string().uuid(),
  toUserId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
