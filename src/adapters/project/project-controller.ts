import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectUseCases } from '../../application/index.js';
import {
  createProjectBodySchema,
  projectIdParamSchema,
  updateProjectBodySchema,
} from './map-project-request.js';
import { sendMappedProjectError } from './send-project-error.js';

export type ProjectControllerDeps = {
  projectUseCases: ProjectUseCases;
};

function getAuthenticatedUserId(request: FastifyRequest): string {
  return request.accessTokenClaims!.sub;
}

export function createProjectController(deps: ProjectControllerDeps) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const body = createProjectBodySchema.parse(request.body);
        const ownerId = getAuthenticatedUserId(request);

        const result = await deps.projectUseCases.create({
          ownerId,
          name: body.name,
          ...(body.description !== undefined ? { description: body.description } : {}),
        });

        void reply.status(201).send(result);
      } catch (error: unknown) {
        sendMappedProjectError(reply, error);
      }
    },

    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const ownerId = getAuthenticatedUserId(request);
        const result = await deps.projectUseCases.list({ ownerId });
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedProjectError(reply, error);
      }
    },

    async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: projectId } = projectIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);

        const result = await deps.projectUseCases.get({ projectId, userId });
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedProjectError(reply, error);
      }
    },

    async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: projectId } = projectIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);
        const body = updateProjectBodySchema.parse(request.body);

        const result = await deps.projectUseCases.update({
          projectId,
          userId,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
        });

        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedProjectError(reply, error);
      }
    },

    async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: projectId } = projectIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);

        await deps.projectUseCases.delete({ projectId, userId });
        void reply.status(204).send();
      } catch (error: unknown) {
        sendMappedProjectError(reply, error);
      }
    },
  };
}
