import { z } from 'zod';

export const assignTaskInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  taskId: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
  assigneeId: z.string().min(1).nullable(),
});

export type AssignTaskInputDto = z.infer<typeof assignTaskInputSchema>;
