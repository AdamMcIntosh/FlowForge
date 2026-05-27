import { afterEach, describe, expect, it } from 'vitest';

import { createNoOpRateLimiter } from './infrastructure/auth/rate-limiter.js';
import { buildServer } from './server.js';

describe('server auth rate limiting', () => {
  let app: Awaited<ReturnType<typeof buildServer>> | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 429 for /auth routes when the rate limit is exceeded', async () => {
    app = await buildServer({
      rateLimiter: {
        check(_key: string) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
        checkMany(_keys: readonly string[]) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: '{ invalid json',
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('60');
    expect(response.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });

  it('does not rate limit non-auth routes', async () => {
    app = await buildServer({
      rateLimiter: {
        check(_key: string) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
        checkMany(_keys: readonly string[]) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows auth routes when using the no-op rate limiter', async () => {
    app = await buildServer({
      rateLimiter: createNoOpRateLimiter(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(response.statusCode).not.toBe(429);
  });
});
