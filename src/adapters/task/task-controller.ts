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

        const hasTitle = body.title !== undefined;
        const hasDescription = body.description !== undefined;
        const hasStatus = body.status !== undefined;
        const hasAssigneeId = body.assigneeId !== undefined;
        const fieldCount =
          Number(hasTitle) + Number(hasDescription) + Number(hasStatus) + Number(hasAssigneeId);

        let result;

        if (fieldCount === 1 && hasAssigneeId) {
          result = await deps.taskUseCases.assign({
            userId,
            taskId,
            assigneeId: body.assigneeId!,
          });
        } else if (fieldCount === 1 && hasStatus) {
          result = await deps.taskUseCases.changeStatus({
            userId,
            taskId,
            status: body.status!,
          });
        } else {
          result = await deps.taskUseCases.update({
            userId,
            taskId,
            ...(hasTitle ? { title: body.title } : {}),
            ...(hasDescription ? { description: body.description } : {}),
            ...(hasStatus ? { status: body.status } : {}),
            ...(hasAssigneeId ? { assigneeId: body.assigneeId } : {}),
          });
        }

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
