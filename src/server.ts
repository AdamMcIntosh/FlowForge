import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

import {
  createAuthUseCasesFromInfrastructure,
  type AuthUseCases,
} from './application/index.js';
import {
  createAuthInfrastructure,
  createDatabase,
  createFixedWindowRateLimiter,
  createJwtService,
  getEnv,
  registerEarlyRateLimit,
  type JwtService,
  type RateLimiter,
} from './infrastructure/index.js';
import { registerErrorHandler } from './infrastructure/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';

export type BuildServerOptions = {
  rateLimiter?: RateLimiter;
  authUseCases?: AuthUseCases;
  jwtService?: JwtService;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const env = getEnv();

  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  registerErrorHandler(app);

  let rateLimiter = options.rateLimiter;
  let authUseCases = options.authUseCases;
  let jwtService = options.jwtService;

  if (authUseCases === undefined) {
    const database = createDatabase(env);
    const auth = createAuthInfrastructure(env, database.prisma);
    rateLimiter ??= auth.rateLimiter;
    jwtService ??= auth.jwtService;
    authUseCases = createAuthUseCasesFromInfrastructure(auth, {
      accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  jwtService ??= createJwtService(env);

  rateLimiter ??= createFixedWindowRateLimiter(
    env.RATE_LIMIT_WINDOW_MS,
    env.RATE_LIMIT_MAX_REQUESTS,
  );

  registerEarlyRateLimit(app, { rateLimiter, pathPrefix: '/auth' });

  await app.register(healthRoutes);
  await app.register(authRoutes, { authUseCases, rateLimiter });
  await app.register(meRoutes, { jwtService });

  return app;
}

export async function start() {
  const env = getEnv();
  const database = createDatabase(env);
  const auth = createAuthInfrastructure(env, database.prisma);
  const authUseCases = createAuthUseCasesFromInfrastructure(auth, {
    accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
  });
  const app = await buildServer({
    rateLimiter: auth.rateLimiter,
    authUseCases,
  });

  await database.connectDatabase();

  const shutdown = async (): Promise<void> => {
    await app.close();
    await database.disconnectDatabase();
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  return { app, database };
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  start().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
