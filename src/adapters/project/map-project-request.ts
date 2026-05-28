import { z } from 'zod';

import { createProjectInputSchema } from '../../application/index.js';

export const createProjectBodySchema = createProjectInputSchema.omit({ ownerId: true });

export const updateProjectBodySchema = z
  .object({
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

export const projectIdParamSchema = z.object({
  id: z.string({ required_error: 'Project id is required' }).min(1, 'Project id is required'),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
export type ProjectIdParams = z.infer<typeof projectIdParamSchema>;
