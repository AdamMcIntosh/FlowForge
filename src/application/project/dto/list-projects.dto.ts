import { z } from 'zod';

export const listProjectsInputSchema = z.object({
  ownerId: z.string({ required_error: 'Owner id is required' }).min(1, 'Owner id is required'),
});

export type ListProjectsInputDto = z.infer<typeof listProjectsInputSchema>;
