import { z } from 'zod';

export const listTasksInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  projectId: z
    .string({ required_error: 'Project id is required' })
    .min(1, 'Project id is required'),
});

export type ListTasksInputDto = z.infer<typeof listTasksInputSchema>;
