import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '../config.js';
import { createJwtService } from './jwt-service.js';
import {
  buildIpRateLimitKey,
  buildUserRateLimitKey,
  createFixedWindowRateLimiter,
  createNoOpRateLimiter,
  getClientIp,
  getUserIdFromAuthorizationHeader,
  registerEarlyRateLimit,
  resolveAuthRateLimitKeys,
  sendRateLimitExceeded,
} from './rate-limiter.js';

function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    ip: '127.0.0.1',
    url: '/auth/login',
    headers: {},
    ...overrides,
  } as FastifyRequest;
}

describe('buildIpRateLimitKey', () => {
  it('prefixes the client ip', () => {
    expect(buildIpRateLimitKey('203.0.113.10')).toBe('ip:203.0.113.10');
  });
});

describe('buildUserRateLimitKey', () => {
  it('prefixes the user id', () => {
    expect(buildUserRateLimitKey('user-1')).toBe('user:user-1');
  });
});

describe('createFixedWindowRateLimiter', () => {
  let limiter: ReturnType<typeof createFixedWindowRateLimiter>;

  beforeEach(() => {
    limiter = createFixedWindowRateLimiter(60_000, 2);
  });

  it('allows requests until the window limit is reached', () => {
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
    expect(limiter.check('127.0.0.1').allowed).toBe(true);

    const blocked = limiter.check('127.0.0.1');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.remaining).toBe(0);
    }
  });

  it('tracks ip and user keys independently', () => {
    const singleRequestLimiter = createFixedWindowRateLimiter(60_000, 1);
    const ipKey = buildIpRateLimitKey('127.0.0.1');
    const userKey = buildUserRateLimitKey('user-1');

    expect(singleRequestLimiter.check(ipKey).allowed).toBe(true);
    expect(singleRequestLimiter.check(userKey).allowed).toBe(true);
    expect(singleRequestLimiter.check(ipKey).allowed).toBe(false);
    expect(singleRequestLimiter.check(userKey).allowed).toBe(false);
  });

  it('checkMany blocks when any key is exhausted without incrementing others', () => {
    const singleKeyLimiter = createFixedWindowRateLimiter(60_000, 1);
    const ipKey = buildIpRateLimitKey('127.0.0.1');
    const userKey = buildUserRateLimitKey('user-1');

    expect(singleKeyLimiter.check(ipKey).allowed).toBe(true);

    const blocked = singleKeyLimiter.checkMany([ipKey, userKey]);
    expect(blocked.allowed).toBe(false);

    expect(singleKeyLimiter.check(userKey).allowed).toBe(true);
  });

  it('checkMany increments all keys when allowed', () => {
    const singleKeyLimiter = createFixedWindowRateLimiter(60_000, 1);
    const ipKey = buildIpRateLimitKey('127.0.0.1');
    const userKey = buildUserRateLimitKey('user-1');

    expect(singleKeyLimiter.checkMany([ipKey, userKey]).allowed).toBe(true);
    expect(singleKeyLimiter.check(ipKey).allowed).toBe(false);
    expect(singleKeyLimiter.check(userKey).allowed).toBe(false);
  });

  it('allows checkMany with no keys without consuming quota', () => {
    const result = limiter.checkMany([]);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(2);
    }

    expect(limiter.check('fresh-key').allowed).toBe(true);
  });

  it('resets the window after windowMs elapses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-27T12:00:00.000Z'));

    try {
      const windowedLimiter = createFixedWindowRateLimiter(1_000, 1);

      expect(windowedLimiter.check('127.0.0.1').allowed).toBe(true);
      expect(windowedLimiter.check('127.0.0.1').allowed).toBe(false);

      vi.advanceTimersByTime(1_000);

      expect(windowedLimiter.check('127.0.0.1').allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createNoOpRateLimiter', () => {
  it('always allows requests without tracking keys', () => {
    const limiter = createNoOpRateLimiter();

    expect(limiter.check('any-key').allowed).toBe(true);
    expect(limiter.checkMany(['a', 'b', 'c']).allowed).toBe(true);
    expect(limiter.check('any-key').allowed).toBe(true);
  });
});

describe('getClientIp', () => {
  it('uses the first x-forwarded-for address when present', () => {
    const request = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.2' },
      ip: '127.0.0.1',
    });

    expect(getClientIp(request)).toBe('203.0.113.10');
  });

  it('falls back to request.ip when x-forwarded-for is absent', () => {
    const request = createMockRequest({ ip: '10.0.0.5' });

    expect(getClientIp(request)).toBe('10.0.0.5');
  });

  it('falls back to request.ip when x-forwarded-for is empty', () => {
    const request = createMockRequest({
      headers: { 'x-forwarded-for': '' },
      ip: '10.0.0.5',
    });

    expect(getClientIp(request)).toBe('10.0.0.5');
  });
});

describe('getUserIdFromAuthorizationHeader', () => {
  let jwtService: ReturnType<typeof createJwtService>;

  beforeEach(() => {
    jwtService = createJwtService(getEnv());
  });

  it('returns undefined when authorization header is missing', () => {
    expect(getUserIdFromAuthorizationHeader(createMockRequest())).toBeUndefined();
  });

  it('returns undefined for non-bearer authorization schemes', () => {
    const request = createMockRequest({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });

    expect(getUserIdFromAuthorizationHeader(request)).toBeUndefined();
  });

  it('returns undefined for an empty bearer token', () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer   ' },
    });

    expect(getUserIdFromAuthorizationHeader(request)).toBeUndefined();
  });

  it('extracts user id from bearer tokens without verifying signatures', () => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
    const signed = jwtService.signAccessToken({
      userId: 'user-2',
      email: 'other@example.com',
      issuedAt,
      expiresAt,
    });

    const request = createMockRequest({
      headers: { authorization: `Bearer ${signed.token}` },
    });

    expect(getUserIdFromAuthorizationHeader(request)).toBe('user-2');
  });

  it('returns undefined when the bearer token cannot be decoded to a payload', () => {
    const request = createMockRequest({
      headers: { authorization: 'Bearer not-a-jwt' },
    });

    expect(getUserIdFromAuthorizationHeader(request)).toBeUndefined();
  });
});

describe('resolveAuthRateLimitKeys', () => {
  let jwtService: ReturnType<typeof createJwtService>;

  beforeEach(() => {
    jwtService = createJwtService(getEnv());
  });

  it('returns only the ip key when no bearer token is present', () => {
    const request = createMockRequest({
      ip: '203.0.113.10',
      headers: {},
    });

    expect(resolveAuthRateLimitKeys(request)).toEqual([
      buildIpRateLimitKey('203.0.113.10'),
    ]);
  });

  it('includes ip and user keys when a bearer token is present', () => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
    const signed = jwtService.signAccessToken({
      userId: 'user-1',
      email: 'user@example.com',
      issuedAt,
      expiresAt,
    });

    const request = createMockRequest({
      ip: '203.0.113.10',
      headers: { authorization: `Bearer ${signed.token}` },
    });

    expect(resolveAuthRateLimitKeys(request)).toEqual([
      buildIpRateLimitKey('203.0.113.10'),
      buildUserRateLimitKey('user-1'),
    ]);
  });
});

describe('sendRateLimitExceeded', () => {
  it('sets Retry-After, status 429, and a structured JSON body', () => {
    const reply = {
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    sendRateLimitExceeded(reply as unknown as FastifyReply, {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSeconds: 30,
    });

    expect(reply.header).toHaveBeenCalledWith('Retry-After', '30');
    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });
});

describe('registerEarlyRateLimit', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('returns 429 for auth routes when the shared limiter is exhausted', async () => {
    const limiter = createFixedWindowRateLimiter(60_000, 1);

    app = Fastify();
    registerEarlyRateLimit(app, { rateLimiter: limiter, pathPrefix: '/auth' });
    app.post('/auth/login', async () => ({ ok: true }));
    await app.ready();

    const first = await app.inject({ method: 'POST', url: '/auth/login' });
    const second = await app.inject({ method: 'POST', url: '/auth/login' });

    expect(first.statusCode).not.toBe(429);
    expect(second.statusCode).toBe(429);
    expect(second.headers['retry-after']).toBeDefined();
    expect(second.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });

  it('does not rate limit routes outside the configured prefix', async () => {
    const limiter = createFixedWindowRateLimiter(60_000, 1);

    app = Fastify();
    registerEarlyRateLimit(app, { rateLimiter: limiter, pathPrefix: '/auth' });
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();

    const first = await app.inject({ method: 'GET', url: '/health' });
    const second = await app.inject({ method: 'GET', url: '/health' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
  });
});
