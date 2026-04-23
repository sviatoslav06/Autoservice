import { z } from 'zod';

const CURRENT_YEAR = new Date().getFullYear();

export const createVehicleSchema = z.object({
  clientId: z.number().int().positive().optional(),
  make: z.string().min(2, 'Make is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  year: z.number().int().min(1980).max(CURRENT_YEAR),
  vin: z.string().min(5).max(32),
  licensePlate: z.string().min(3).max(32),
  kilometrage: z.number().int().min(0).optional(),
});

export const updateVehicleSchema = z.object({
  make: z.string().min(2).max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1980).max(CURRENT_YEAR).optional(),
  vin: z.string().min(5).max(32).optional(),
  licensePlate: z.string().min(3).max(32).optional(),
  kilometrage: z.number().int().min(0).optional(),
});
