import { z } from 'zod';

const HAS_LETTER = /[A-Za-z]/;
const HAS_NUMBER = /\d/;

export const registerInputSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .refine((value) => HAS_LETTER.test(value), 'Password must contain at least one letter')
    .refine((value) => HAS_NUMBER.test(value), 'Password must contain at least one number'),
});

export type RegisterInputDto = z.infer<typeof registerInputSchema>;
