import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(2, 'Name is required').max(255),
  description: z.string().optional(),
  standardPrice: z.number().min(0),
  durationMinutes: z.number().int().min(1),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().optional(),
  standardPrice: z.number().min(0).optional(),
  durationMinutes: z.number().int().min(1).optional(),
});
