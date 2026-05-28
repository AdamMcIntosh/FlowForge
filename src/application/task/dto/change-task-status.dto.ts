import { z } from 'zod';

import { TaskStatus } from '../../../domain/index.js';

const taskStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
]);

export const changeTaskStatusInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  taskId: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
  status: taskStatusSchema,
});

export type ChangeTaskStatusInputDto = z.infer<typeof changeTaskStatusInputSchema>;
