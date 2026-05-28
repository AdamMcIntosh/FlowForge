import { z } from 'zod';

export const projectResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  ownerId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectResponseDto = z.infer<typeof projectResponseSchema>;

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectResponseSchema),
});

export type ListProjectsResponseDto = z.infer<typeof listProjectsResponseSchema>;
