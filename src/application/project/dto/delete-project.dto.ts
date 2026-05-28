import { z } from 'zod';

export const deleteProjectInputSchema = z.object({
  projectId: z.string({ required_error: 'Project id is required' }).min(1, 'Project id is required'),
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
});

export type DeleteProjectInputDto = z.infer<typeof deleteProjectInputSchema>;
