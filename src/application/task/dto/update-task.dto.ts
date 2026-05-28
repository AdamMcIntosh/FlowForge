import { z } from 'zod';

import { TaskStatus } from '../../../domain/index.js';

const taskStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
]);

export const updateTaskInputSchema = z
  .object({
    userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
    taskId: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title must be at most 255 characters')
      .optional(),
    description: z
      .string()
      .max(2000, 'Description must be at most 2000 characters')
      .nullable()
      .optional(),
    status: taskStatusSchema.optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.assigneeId !== undefined,
    {
      message: 'At least one field must be provided for update',
    },
  );

export type UpdateTaskInputDto = z.infer<typeof updateTaskInputSchema>;
