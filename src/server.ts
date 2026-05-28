import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';

import {
  createAuthUseCasesFromInfrastructure,
  createProjectUseCasesFromInfrastructure,
  createTaskUseCasesFromInfrastructure,
  type AuthUseCases,
  type ProjectUseCases,
  type TaskUseCases,
} from './application/index.js';
import {
  createAuthInfrastructure,
  createDatabase,
  createFixedWindowRateLimiter,
  createJwtService,
  createPrismaProjectRepository,
  createPrismaTaskRepository,
  getEnv,
  registerEarlyRateLimit,
  type JwtService,
  type RateLimiter,
} from './infrastructure/index.js';
import { registerErrorHandler } from './infrastructure/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';

export type BuildServerOptions = {
  rateLimiter?: RateLimiter;
  authUseCases?: AuthUseCases;
  jwtService?: JwtService;
  projectUseCases?: ProjectUseCases;
  taskUseCases?: TaskUseCases;
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
  let projectUseCases = options.projectUseCases;
  let taskUseCases = options.taskUseCases;

  if (
    authUseCases === undefined ||
    projectUseCases === undefined ||
    taskUseCases === undefined
  ) {
    const database = createDatabase(env);
    const prisma = database.prisma;
    const projectRepository = createPrismaProjectRepository(prisma);

    if (authUseCases === undefined) {
      const auth = createAuthInfrastructure(env, prisma);
      rateLimiter ??= auth.rateLimiter;
      jwtService ??= auth.jwtService;
      authUseCases = createAuthUseCasesFromInfrastructure(auth, {
        accessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
        refreshTokenTtlSeconds: env.JWT_REFRESH_TOKEN_TTL_SECONDS,
      });
    }

    if (projectUseCases === undefined) {
      projectUseCases = createProjectUseCasesFromInfrastructure(projectRepository);
    }

    if (taskUseCases === undefined) {
      taskUseCases = createTaskUseCasesFromInfrastructure(
        createPrismaTaskRepository(prisma),
        projectRepository,
      );
    }
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
  await app.register(projectRoutes, { projectUseCases, jwtService });
  await app.register(taskRoutes, { taskUseCases, jwtService });

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
