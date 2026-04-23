import { z } from 'zod';

const FIELD_TYPES = ['text', 'number', 'date', 'boolean'] as const;

export const createFieldSchema = z.object({
  categoryId: z.number().int().positive(),
  fieldName: z.string().min(1).max(255),
  fieldType: z.enum(FIELD_TYPES),
  isRequired: z.boolean().optional(),
});

export const updateFieldSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  fieldName: z.string().min(1).max(255).optional(),
  fieldType: z.enum(FIELD_TYPES).optional(),
  isRequired: z.boolean().optional(),
});
