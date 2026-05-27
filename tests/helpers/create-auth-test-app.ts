import { createAuthUseCases } from '../../src/application/auth/create-auth-use-cases.js';
import type { AuthUseCases } from '../../src/application/auth/types.js';
import { createArgon2PasswordHasher } from '../../src/infrastructure/auth/password-hasher.js';
import { createJwtService } from '../../src/infrastructure/auth/jwt-service.js';
import { createInMemoryRefreshTokenRepository } from '../../src/infrastructure/auth/refresh-token-repository.js';
import {
  createFixedWindowRateLimiter,
  createNoOpRateLimiter,
  type RateLimiter,
} from '../../src/infrastructure/auth/rate-limiter.js';
import type { JwtService, UserRepository } from '../../src/infrastructure/auth/types.js';
import { getEnv } from '../../src/infrastructure/config.js';
import { buildServer } from '../../src/server.js';
import { createInMemoryUserRepository } from './in-memory-user-repository.js';

export type AuthTestApp = {
  app: Awaited<ReturnType<typeof buildServer>>;
  authUseCases: AuthUseCases;
  userRepository: UserRepository;
  jwtService: JwtService;
  rateLimiter: RateLimiter;
};

export type CreateAuthTestAppOptions = {
  rateLimiter?: RateLimiter;
  rateLimitMaxRequests?: number;
};

export async function createAuthTestApp(
  options: CreateAuthTestAppOptions = {},
): Promise<AuthTestApp> {
  const env = getEnv();
  const userRepository = createInMemoryUserRepository();
  const jwtService = createJwtService(env);
  const passwordHasher = createArgon2PasswordHasher();
  const refreshTokenRepository = createInMemoryRefreshTokenRepository();

  const rateLimiter =
    options.rateLimiter ??
    (options.rateLimitMaxRequests !== undefined
      ? createFixedWindowRateLimiter(env.RATE_LIMIT_WINDOW_MS, options.rateLimitMaxRequests)
      : createNoOpRateLimiter());

  const authUseCases = createAuthUseCases({
    jwtService,
    passwordHasher,
    userRepository,
    refreshTokenRepository,
    tokenSettings: {
      accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
    },
  });

  const app = await buildServer({ authUseCases, rateLimiter, jwtService });

  return {
    app,
    authUseCases,
    userRepository,
    jwtService,
    rateLimiter,
  };
}
