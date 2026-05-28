import { z } from 'zod';

export const updateProjectInputSchema = z
  .object({
    projectId: z
      .string({ required_error: 'Project id is required' })
      .min(1, 'Project id is required'),
    userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(255, 'Name must be at most 255 characters')
      .optional(),
    description: z
      .string()
      .max(2000, 'Description must be at most 2000 characters')
      .nullable()
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided for update',
  });

export type UpdateProjectInputDto = z.infer<typeof updateProjectInputSchema>;
