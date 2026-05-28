import { z } from 'zod';

export const deleteTaskInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  taskId: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
});

export type DeleteTaskInputDto = z.infer<typeof deleteTaskInputSchema>;
