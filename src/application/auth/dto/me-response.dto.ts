import { z } from 'zod';

export const meResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
});

export type MeResponseDto = z.infer<typeof meResponseSchema>;
