import type { FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/health', () => ({ status: 'ok' }));
  done();
};
