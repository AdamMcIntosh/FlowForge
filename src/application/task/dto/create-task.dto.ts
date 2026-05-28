import { z } from 'zod';

import { TaskStatus } from '../../../domain/index.js';

const taskStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
]);

export const createTaskInputSchema = z.object({
  userId: z.string({ required_error: 'User id is required' }).min(1, 'User id is required'),
  projectId: z
    .string({ required_error: 'Project id is required' })
    .min(1, 'Project id is required'),
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters'),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .nullable()
    .optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
});

export type CreateTaskInputDto = z.infer<typeof createTaskInputSchema>;
