import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_TYPE, createAccessTokenClaims } from '../../domain/auth/auth-token-claims.js';
import { getEnv } from '../config.js';
import {
  createJwtAuthMiddleware,
  extractBearerToken,
  sendJwtUnauthorized,
} from './jwt-auth-middleware.js';
import { createJwtService, JwtVerificationError } from './jwt-service.js';
import type { JwtService } from './types.js';

function createMockRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers } as FastifyRequest;
}

function createMockReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;
}

function createMockJwtService(overrides: Partial<JwtService> = {}): JwtService {
  return {
    signAccessToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    ...overrides,
  };
}

function futureTokenDates(): { issuedAt: Date; expiresAt: Date } {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
  return { issuedAt, expiresAt };
}

function expiredTokenDates(): { issuedAt: Date; expiresAt: Date } {
  return {
    issuedAt: new Date('2020-01-01T00:00:00.000Z'),
    expiresAt: new Date('2020-01-02T00:00:00.000Z'),
  };
}

const unauthorizedBody = (message: string) => ({
  statusCode: 401,
  error: 'Unauthorized',
  message,
  code: 'AUTH_UNAUTHORIZED',
});

describe('extractBearerToken', () => {
  it('returns undefined when the authorization header is missing', () => {
    expect(extractBearerToken(createMockRequest())).toBeUndefined();
  });

  it('returns undefined for non-bearer schemes', () => {
    expect(extractBearerToken(createMockRequest({ authorization: 'Basic abc' }))).toBeUndefined();
  });

  it('returns undefined for an empty bearer token', () => {
    expect(extractBearerToken(createMockRequest({ authorization: 'Bearer   ' }))).toBeUndefined();
  });

  it('extracts the token from a bearer authorization header', () => {
    expect(
      extractBearerToken(createMockRequest({ authorization: 'Bearer access-token-123' })),
    ).toBe('access-token-123');
  });

  it('trims whitespace around the bearer token value', () => {
    expect(
      extractBearerToken(createMockRequest({ authorization: 'Bearer   trimmed-token   ' })),
    ).toBe('trimmed-token');
  });
});

describe('sendJwtUnauthorized', () => {
  it('sends a consistent 401 JSON body', () => {
    const reply = createMockReply();

    sendJwtUnauthorized(reply, 'Authentication required');

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Authentication required'));
  });

  it('forwards custom unauthorized messages', () => {
    const reply = createMockReply();

    sendJwtUnauthorized(reply, 'Invalid or expired token');

    expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Invalid or expired token'));
  });
});

describe('createJwtAuthMiddleware preHandler', () => {
  let jwtService: JwtService;
  let jwtAuth: ReturnType<typeof createJwtAuthMiddleware>;

  beforeEach(() => {
    jwtService = createJwtService(getEnv());
    jwtAuth = createJwtAuthMiddleware({ jwtService });
  });

  describe('missing or malformed authorization', () => {
    it('returns 401 when no authorization header is present', async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Authentication required'));
      expect(request.accessTokenClaims).toBeUndefined();
    });

    it('returns 401 for non-bearer authorization schemes', async () => {
      const request = createMockRequest({ authorization: 'Basic dXNlcjpwYXNz' });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Authentication required'));
      expect(request.accessTokenClaims).toBeUndefined();
    });

    it('returns 401 for an empty bearer token', async () => {
      const request = createMockRequest({ authorization: 'Bearer   ' });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Authentication required'));
      expect(request.accessTokenClaims).toBeUndefined();
    });
  });

  describe('invalid tokens', () => {
    it('returns 401 for malformed tokens', async () => {
      const request = createMockRequest({ authorization: 'Bearer not-a-jwt' });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Invalid or expired token'));
      expect(request.accessTokenClaims).toBeUndefined();
    });

    it('returns 401 for expired access tokens', async () => {
      const { issuedAt, expiresAt } = expiredTokenDates();
      const signed = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'user@example.com',
        issuedAt,
        expiresAt,
      });

      const request = createMockRequest({ authorization: `Bearer ${signed.token}` });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Invalid or expired token'));
      expect(request.accessTokenClaims).toBeUndefined();
    });

    it('returns 401 when a refresh token is presented as a bearer token', async () => {
      const { issuedAt, expiresAt } = futureTokenDates();
      const refresh = jwtService.signRefreshToken({
        userId: 'user-1',
        family: 'family-1',
        issuedAt,
        expiresAt,
      });

      const request = createMockRequest({ authorization: `Bearer ${refresh.token}` });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Invalid or expired token'));
      expect(request.accessTokenClaims).toBeUndefined();
    });
  });

  describe('successful verification', () => {
    it('attaches access token claims and does not send an unauthorized response', async () => {
      const { issuedAt, expiresAt } = futureTokenDates();
      const signed = jwtService.signAccessToken({
        userId: 'user-42',
        email: 'alice@example.com',
        issuedAt,
        expiresAt,
      });

      const request = createMockRequest({ authorization: `Bearer ${signed.token}` });
      const reply = createMockReply();

      await jwtAuth.preHandler(request, reply);

      expect(request.accessTokenClaims).toEqual(signed.claims);
      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });
  });
});

describe('createJwtAuthMiddleware preHandler with injected jwtService', () => {
  let jwtAuth: ReturnType<typeof createJwtAuthMiddleware>;
  let verifyAccessToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    verifyAccessToken = vi.fn();
    jwtAuth = createJwtAuthMiddleware({
      jwtService: createMockJwtService({ verifyAccessToken }),
    });
  });

  it('maps JwtVerificationError messages to 401 responses', async () => {
    verifyAccessToken.mockImplementation(() => {
      throw new JwtVerificationError('Token revoked');
    });

    const request = createMockRequest({ authorization: 'Bearer some-token' });
    const reply = createMockReply();

    await jwtAuth.preHandler(request, reply);

    expect(verifyAccessToken).toHaveBeenCalledWith('some-token');
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(unauthorizedBody('Token revoked'));
    expect(request.accessTokenClaims).toBeUndefined();
  });

  it('re-throws unexpected errors from jwtService.verifyAccessToken', async () => {
    verifyAccessToken.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    const request = createMockRequest({ authorization: 'Bearer some-token' });
    const reply = createMockReply();

    await expect(jwtAuth.preHandler(request, reply)).rejects.toThrow('database unavailable');
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('stores verified claims on the request when verification succeeds', async () => {
    const claims = createAccessTokenClaims({
      userId: 'user-99',
      email: 'verified@example.com',
      jti: 'claim-jti',
      issuedAt: new Date('2025-05-27T12:00:00.000Z'),
      expiresAt: new Date('2025-05-27T13:00:00.000Z'),
    });
    verifyAccessToken.mockReturnValue(claims);

    const request = createMockRequest({ authorization: 'Bearer verified-token' });
    const reply = createMockReply();

    await jwtAuth.preHandler(request, reply);

    expect(request.accessTokenClaims).toEqual(claims);
    expect(request.accessTokenClaims?.type).toBe(ACCESS_TOKEN_TYPE);
    expect(reply.status).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
