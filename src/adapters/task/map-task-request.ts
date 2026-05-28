import { z } from 'zod';

import { createTaskInputSchema, updateTaskInputSchema } from '../../application/index.js';

export const createTaskBodySchema = createTaskInputSchema.omit({ userId: true, projectId: true });

export const updateTaskBodySchema = updateTaskInputSchema
  .innerType()
  .omit({ userId: true, taskId: true })
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

export const projectIdParamSchema = z.object({
  id: z.string({ required_error: 'Project id is required' }).min(1, 'Project id is required'),
});

export const taskIdParamSchema = z.object({
  id: z.string({ required_error: 'Task id is required' }).min(1, 'Task id is required'),
});

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type ProjectIdParams = z.infer<typeof projectIdParamSchema>;
export type TaskIdParams = z.infer<typeof taskIdParamSchema>;
