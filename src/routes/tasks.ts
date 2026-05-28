import type { FastifyPluginCallback } from 'fastify';

import { createTaskController } from '../adapters/task/index.js';
import type { TaskUseCases } from '../application/index.js';
import { createJwtAuthMiddleware, type JwtService } from '../infrastructure/index.js';

export type TaskRouteOptions = {
  taskUseCases: TaskUseCases;
  jwtService: JwtService;
};

export const taskRoutes: FastifyPluginCallback<TaskRouteOptions> = (app, options, done) => {
  const controller = createTaskController({ taskUseCases: options.taskUseCases });
  const jwtAuth = createJwtAuthMiddleware({ jwtService: options.jwtService });

  app.post(
    '/projects/:id/tasks',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.create(request, reply),
  );

  app.get(
    '/projects/:id/tasks',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.list(request, reply),
  );

  app.get(
    '/tasks/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.get(request, reply),
  );

  app.patch(
    '/tasks/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.update(request, reply),
  );

  app.delete(
    '/tasks/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.delete(request, reply),
  );

  done();
};
