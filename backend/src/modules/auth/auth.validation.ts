import { z } from 'zod';

const USER_ROLES = ['Client', 'Manager', 'Mechanic', 'Accountant', 'Admin'] as const;

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().max(32).optional(),
  role: z.enum(USER_ROLES).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50).optional(),
  phone: z.string().max(32).optional(),
});
