import { z } from 'zod';

export const refreshResultSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export type RefreshResultDto = z.infer<typeof refreshResultSchema>;
