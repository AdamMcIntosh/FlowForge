import { afterEach, describe, expect, it } from 'vitest';

import { buildServer } from './server.js';

describe('server', () => {
  let app: Awaited<ReturnType<typeof buildServer>> | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      app = await buildServer();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });
  });

  describe('error handler', () => {
    it('returns 404 JSON for unknown routes', async () => {
      app = await buildServer();

      const response = await app.inject({
        method: 'GET',
        url: '/unknown',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
      });
    });

    it('returns 400 JSON for invalid JSON body', async () => {
      app = await buildServer();

      const response = await app.inject({
        method: 'POST',
        url: '/unknown',
        headers: { 'content-type': 'application/json' },
        payload: '{ invalid json',
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid JSON body',
      });
    });
  });
});
