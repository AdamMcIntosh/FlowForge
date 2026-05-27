import type { FastifyPluginCallback } from 'fastify';

import { createAuthController } from '../adapters/auth/index.js';
import type { AuthUseCases } from '../application/index.js';
import type { RateLimiter } from '../infrastructure/index.js';

export type AuthRouteOptions = {
  authUseCases: AuthUseCases;
  rateLimiter: RateLimiter;
};

export const authRoutes: FastifyPluginCallback<AuthRouteOptions> = (app, options, done) => {
  const controller = createAuthController({
    authUseCases: options.authUseCases,
    rateLimiter: options.rateLimiter,
  });

  app.post('/auth/register', (request, reply) => controller.register(request, reply));
  app.post('/auth/login', (request, reply) => controller.login(request, reply));
  app.post('/auth/logout', (request, reply) => controller.logout(request, reply));
  app.post('/auth/refresh', (request, reply) => controller.refresh(request, reply));

  done();
};
