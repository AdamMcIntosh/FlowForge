import { createAuthUseCases } from '../../src/application/auth/create-auth-use-cases.js';
import type { AuthUseCases } from '../../src/application/auth/types.js';
import { createProjectUseCasesFromInfrastructure } from '../../src/application/project/create-project-use-cases.js';
import type { ProjectUseCases } from '../../src/application/project/types.js';
import { createTaskUseCasesFromInfrastructure } from '../../src/application/task/create-task-use-cases.js';
import type { TaskUseCases } from '../../src/application/task/types.js';
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
import type { ProjectRepository } from '../../src/infrastructure/project/types.js';
import type { TaskRepository } from '../../src/infrastructure/task/types.js';
import { buildServer } from '../../src/server.js';
import { createInMemoryProjectRepository } from './in-memory-project-repository.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
import { createInMemoryUserRepository } from './in-memory-user-repository.js';

export type AuthTestApp = {
  app: Awaited<ReturnType<typeof buildServer>>;
  authUseCases: AuthUseCases;
  userRepository: UserRepository;
  jwtService: JwtService;
  rateLimiter: RateLimiter;
  projectRepository: ProjectRepository;
  projectUseCases: ProjectUseCases;
  taskRepository: TaskRepository;
  taskUseCases: TaskUseCases;
};

export type CreateAuthTestAppOptions = {
  rateLimiter?: RateLimiter;
  rateLimitMaxRequests?: number;
  projectRepository?: ProjectRepository;
  taskRepository?: TaskRepository;
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

  const projectRepository = options.projectRepository ?? createInMemoryProjectRepository();
  const projectUseCases = createProjectUseCasesFromInfrastructure(projectRepository);
  const taskRepository = options.taskRepository ?? createInMemoryTaskRepository();
  const taskUseCases = createTaskUseCasesFromInfrastructure(taskRepository, projectRepository);

  const app = await buildServer({
    authUseCases,
    rateLimiter,
    jwtService,
    projectUseCases,
    taskUseCases,
  });

  return {
    app,
    authUseCases,
    userRepository,
    jwtService,
    rateLimiter,
    projectRepository,
    projectUseCases,
    taskRepository,
    taskUseCases,
  };
}
