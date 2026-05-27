import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
  type AuthUseCases,
} from '../../application/index.js';
import {
  buildIpRateLimitKey,
  buildUserRateLimitKey,
  getClientIp,
  sendRateLimitExceeded,
  type RateLimiter,
} from '../../infrastructure/index.js';
import { sendMappedAuthError } from './send-auth-error.js';

export type AuthControllerDeps = {
  authUseCases: AuthUseCases;
  rateLimiter: RateLimiter;
};

function normalizeEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}

function enforceEmailRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  rateLimiter: RateLimiter,
  email: string,
): boolean {
  const result = rateLimiter.checkMany([
    buildIpRateLimitKey(getClientIp(request)),
    buildUserRateLimitKey(normalizeEmailForRateLimit(email)),
  ]);

  if (!result.allowed) {
    sendRateLimitExceeded(reply, result);
    return false;
  }

  return true;
}

export function createAuthController(deps: AuthControllerDeps) {
  return {
    async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const input = registerInputSchema.parse(request.body);

        if (!enforceEmailRateLimit(request, reply, deps.rateLimiter, input.email)) {
          return;
        }

        const result = await deps.authUseCases.register(input);
        void reply.status(201).send(result);
      } catch (error: unknown) {
        sendMappedAuthError(reply, error);
      }
    },

    async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const input = loginInputSchema.parse(request.body);

        if (!enforceEmailRateLimit(request, reply, deps.rateLimiter, input.email)) {
          return;
        }

        const result = await deps.authUseCases.login(input);
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedAuthError(reply, error);
      }
    },

    async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const input = logoutInputSchema.parse(request.body);
        await deps.authUseCases.logout(input);
        void reply.status(204).send();
      } catch (error: unknown) {
        sendMappedAuthError(reply, error);
      }
    },

    async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const input = refreshInputSchema.parse(request.body);
        const result = await deps.authUseCases.refresh(input);
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedAuthError(reply, error);
      }
    },
  };
}
