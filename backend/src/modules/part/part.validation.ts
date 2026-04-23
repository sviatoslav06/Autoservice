import { z } from 'zod';

const customFieldSchema = z.object({
  fieldId: z.number().int().positive(),
  value: z.string()
});

export const createPartSchema = z.object({
  categoryId: z.number().int().positive(),
  article: z.string().min(2).max(100),
  name: z.string().min(2).max(255),
  basePrice: z.number().min(0),
  stockQuantity: z.number().int().min(0),
  supplier: z.string().max(255).optional(),
  customFields: z.array(customFieldSchema).optional()
});

export const updatePartSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  article: z.string().min(2).max(100).optional(),
  name: z.string().min(2).max(255).optional(),
  basePrice: z.number().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  supplier: z.string().max(255).optional(),
  customFields: z.array(customFieldSchema).optional()
});
