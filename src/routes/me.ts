import type { FastifyPluginCallback } from 'fastify';

import { createMeController } from '../adapters/auth/index.js';
import { createJwtAuthMiddleware, type JwtService } from '../infrastructure/index.js';

export type MeRouteOptions = {
  jwtService: JwtService;
};

export const meRoutes: FastifyPluginCallback<MeRouteOptions> = (app, options, done) => {
  const controller = createMeController();
  const jwtAuth = createJwtAuthMiddleware({ jwtService: options.jwtService });

  app.get('/me', { preHandler: jwtAuth.preHandler }, (request, reply) =>
    controller.getMe(request, reply),
  );

  done();
};
