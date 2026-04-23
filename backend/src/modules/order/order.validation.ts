import { z } from 'zod';

const ORDER_STATUSES = ['planned', 'in_progress', 'ready_for_delivery', 'completed', 'canceled'] as const;
const isValidDateString = (value: string) => !Number.isNaN(new Date(value).getTime());

export const createOrderSchema = z.object({
  clientId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive(),
  boxId: z.number().int().positive().optional(),
  startTime: z.string().refine(isValidDateString, 'Invalid start time'),
  notes: z.string().max(1000).optional(),
  status: z.enum(['planned', 'in_progress']).optional(),

  services: z.array(
    z.object({
      serviceId: z.number(),
      workerId: z.number()
    })
  ).optional(),

  parts: z.array(
    z.object({
      partId: z.number().int().positive(),
      quantity: z.number().int().min(1)
    })
  ).optional()
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES)
});

export const updateOrderSchema = z.object({
  clientId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive().optional(),
  boxId: z.number().int().positive().optional(),
  startTime: z.string().refine(isValidDateString, 'Invalid start time').optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['planned', 'in_progress', 'ready_for_delivery']).optional()
});

export const addOrderPartSchema = z.object({
  partId: z.number().int().positive(),
  quantity: z.number().int().positive()
});

export const updateOrderPartSchema = z.object({
  quantity: z.number().int().positive()
});

export const addOrderServiceSchema = z.object({
  serviceId: z.number().int().positive(),
  workerId: z.number().int().positive().optional()
});

export const updateOrderServiceSchema = z.object({
  actualDurationMinutes: z.number().int().positive().nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  workerId: z.number().int().positive().optional()
});
