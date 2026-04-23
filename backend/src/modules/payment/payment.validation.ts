import { z } from 'zod';

const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const;

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentDate: z.string().datetime().optional(),
}); 
