import type { FastifyReply, FastifyRequest } from 'fastify';

import { meResponseSchema } from '../../application/auth/dto/me-response.dto.js';

export function createMeController() {
  return {
    async getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const claims = request.accessTokenClaims!;

      const body = meResponseSchema.parse({
        id: claims.sub,
        email: claims.email,
      });

      void reply.status(200).send(body);
    },
  };
}
