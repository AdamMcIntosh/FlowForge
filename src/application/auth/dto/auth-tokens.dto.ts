import { z } from 'zod';

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export type AuthTokensDto = z.infer<typeof authTokensSchema>;

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
});

export type AuthUserDto = z.infer<typeof authUserSchema>;

export const authResultSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});

export type AuthResultDto = z.infer<typeof authResultSchema>;
