import { z } from 'zod';

const BOX_STATUSES = ['free', 'busy', 'maintenance'] as const;

export const createBoxSchema = z.object({
  boxNumber: z.string().min(1, 'Box number is required').max(32),
  status: z.enum(BOX_STATUSES).default('free'),
  capacity: z.number().int().min(1).default(1),
});

export const updateBoxSchema = z.object({
  boxNumber: z.string().min(1).max(32).optional(),
  status: z.enum(BOX_STATUSES).optional(),
  capacity: z.number().int().min(1).optional(),
});
