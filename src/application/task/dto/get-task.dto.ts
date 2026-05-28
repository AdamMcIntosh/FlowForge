import { z } from 'zod';

export const getTaskInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  taskId: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
});

export type GetTaskInputDto = z.infer<typeof getTaskInputSchema>;
