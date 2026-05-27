import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AccessTokenClaims } from '../../domain/auth/auth-token-claims.js';
import { JwtVerificationError } from './jwt-service.js';
import type { JwtService } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    accessTokenClaims?: AccessTokenClaims;
  }
}

export type JwtAuthMiddleware = {
  preHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export type CreateJwtAuthMiddlewareOptions = {
  jwtService: JwtService;
};

export function extractBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return undefined;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

export function sendJwtUnauthorized(reply: FastifyReply, message: string): void {
  void reply.status(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    message,
    code: 'AUTH_UNAUTHORIZED',
  });
}

export function createJwtAuthMiddleware(
  options: CreateJwtAuthMiddlewareOptions,
): JwtAuthMiddleware {
  const { jwtService } = options;

  return {
    async preHandler(request, reply): Promise<void> {
      const token = extractBearerToken(request);

      if (token === undefined) {
        sendJwtUnauthorized(reply, 'Authentication required');
        return;
      }

      try {
        request.accessTokenClaims = jwtService.verifyAccessToken(token);
      } catch (error) {
        if (error instanceof JwtVerificationError) {
          sendJwtUnauthorized(reply, error.message);
          return;
        }

        throw error;
      }
    },
  };
}
