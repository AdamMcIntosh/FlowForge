import type { PrismaClient } from '@prisma/client';

import type { Env } from '../config.js';
import { createJwtService } from './jwt-service.js';
import { createArgon2PasswordHasher } from './password-hasher.js';
import { createFixedWindowRateLimiter } from './rate-limiter.js';
import { createInMemoryRefreshTokenRepository } from './refresh-token-repository.js';
import type { AuthInfrastructure } from './types.js';
import { createPrismaUserRepository } from './user-repository.js';

export function createAuthInfrastructure(
  env: Env,
  prisma: PrismaClient,
): AuthInfrastructure {
  return {
    jwtService: createJwtService(env),
    passwordHasher: createArgon2PasswordHasher(),
    rateLimiter: createFixedWindowRateLimiter(
      env.RATE_LIMIT_WINDOW_MS,
      env.RATE_LIMIT_MAX_REQUESTS,
    ),
    userRepository: createPrismaUserRepository(prisma),
    refreshTokenRepository: createInMemoryRefreshTokenRepository(),
  };
}
