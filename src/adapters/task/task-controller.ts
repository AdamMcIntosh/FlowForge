import type { FastifyReply, FastifyRequest } from 'fastify';

import type { TaskUseCases } from '../../application/index.js';
import {
  createTaskBodySchema,
  projectIdParamSchema,
  taskIdParamSchema,
  updateTaskBodySchema,
} from './map-task-request.js';
import { sendMappedTaskError } from './send-task-error.js';

export type TaskControllerDeps = {
  taskUseCases: TaskUseCases;
};

function getAuthenticatedUserId(request: FastifyRequest): string {
  return request.accessTokenClaims!.sub;
}

export function createTaskController(deps: TaskControllerDeps) {
  return {
    async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: projectId } = projectIdParamSchema.parse(request.params);
        const body = createTaskBodySchema.parse(request.body);
        const userId = getAuthenticatedUserId(request);

        const result = await deps.taskUseCases.create({
          userId,
          projectId,
          title: body.title,
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        });

        void reply.status(201).send(result);
      } catch (error: unknown) {
        sendMappedTaskError(reply, error);
      }
    },

    async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: projectId } = projectIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);

        const result = await deps.taskUseCases.list({ userId, projectId });
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedTaskError(reply, error);
      }
    },

    async get(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: taskId } = taskIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);

        const result = await deps.taskUseCases.get({ userId, taskId });
        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedTaskError(reply, error);
      }
    },

    async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: taskId } = taskIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);
        const body = updateTaskBodySchema.parse(request.body);

        const result = await deps.taskUseCases.update({
          userId,
          taskId,
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        });

        void reply.status(200).send(result);
      } catch (error: unknown) {
        sendMappedTaskError(reply, error);
      }
    },

    async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const { id: taskId } = taskIdParamSchema.parse(request.params);
        const userId = getAuthenticatedUserId(request);

        await deps.taskUseCases.delete({ userId, taskId });
        void reply.status(204).send();
      } catch (error: unknown) {
        sendMappedTaskError(reply, error);
      }
    },
  };
}
