import { z } from 'zod';

export const createProjectInputSchema = z.object({
  ownerId: z.string({ required_error: 'Owner id is required' }).min(1, 'Owner id is required'),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .nullable()
    .optional(),
});

export type CreateProjectInputDto = z.infer<typeof createProjectInputSchema>;
