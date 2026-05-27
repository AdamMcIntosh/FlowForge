import { z } from 'zod';

export const logoutInputSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .trim()
    .min(1, 'Refresh token is required'),
});

export type LogoutInputDto = z.infer<typeof logoutInputSchema>;
