import { z } from 'zod';

import { TaskStatus } from '../../../domain/index.js';

const taskStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
]);

export const taskResponseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  status: taskStatusSchema,
  projectId: z.string().min(1),
  assigneeId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TaskResponseDto = z.infer<typeof taskResponseSchema>;

export const listTasksResponseSchema = z.object({
  tasks: z.array(taskResponseSchema),
});

export type ListTasksResponseDto = z.infer<typeof listTasksResponseSchema>;
