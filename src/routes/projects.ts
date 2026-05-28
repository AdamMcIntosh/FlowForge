import type { FastifyPluginCallback } from 'fastify';

import { createProjectController } from '../adapters/project/index.js';
import type { ProjectUseCases } from '../application/index.js';
import { createJwtAuthMiddleware, type JwtService } from '../infrastructure/index.js';

export type ProjectRouteOptions = {
  projectUseCases: ProjectUseCases;
  jwtService: JwtService;
};

export const projectRoutes: FastifyPluginCallback<ProjectRouteOptions> = (app, options, done) => {
  const controller = createProjectController({ projectUseCases: options.projectUseCases });
  const jwtAuth = createJwtAuthMiddleware({ jwtService: options.jwtService });

  app.post(
    '/projects',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.create(request, reply),
  );

  app.get(
    '/projects',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.list(request, reply),
  );

  app.get(
    '/projects/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.get(request, reply),
  );

  app.patch(
    '/projects/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.update(request, reply),
  );

  app.delete(
    '/projects/:id',
    { preHandler: jwtAuth.preHandler },
    (request, reply) => controller.delete(request, reply),
  );

  done();
};
