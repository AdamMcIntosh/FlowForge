/**
 * Unit tests for createTaskController.
 *
 * Uses mocked TaskUseCases doubles to isolate HTTP adapter behavior (status codes,
 * validation, assign/changeStatus dispatch, error mapping). Task-access helpers are
 * covered in src/application/task/task-access.test.ts with in-memory repositories.
 * No PostgreSQL required.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskUseCases } from '../../application/index.js';
import type { ListTasksResponseDto, TaskResponseDto } from '../../application/task/dto/index.js';
import { createAccessTokenClaims } from '../../domain/auth/auth-token-claims.js';
import {
  InvalidTaskDescriptionError,
  InvalidTaskStatusError,
  InvalidTaskTitleError,
  ProjectNotFoundError,
  ProjectOwnershipError,
  TaskNotFoundError,
  TaskStatus,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createTaskController } from './task-controller.js';

const SAMPLE_TASK: TaskResponseDto = {
  id: 'task-1',
  title: 'My Task',
  description: 'Details',
  status: TaskStatus.TODO,
  projectId: 'project-1',
  assigneeId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const SAMPLE_LIST: ListTasksResponseDto = {
  tasks: [SAMPLE_TASK],
};

function createMockReply(): FastifyReply {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;
}

function createAuthenticatedRequest(options: {
  params?: Record<string, string>;
  body?: unknown;
  userId?: string;
}): FastifyRequest {
  const issuedAt = new Date('2025-01-01T00:00:00.000Z');
  const expiresAt = new Date('2025-01-01T01:00:00.000Z');

  return {
    params: options.params ?? {},
    body: options.body,
    accessTokenClaims: createAccessTokenClaims({
      userId: options.userId ?? 'user-1',
      email: 'owner@example.com',
      jti: 'access-jti-1',
      issuedAt,
      expiresAt,
    }),
  } as FastifyRequest;
}

function createMockTaskUseCases(
  overrides: Partial<{
    [K in keyof TaskUseCases]: TaskUseCases[K];
  }> = {},
): TaskUseCases {
  return {
    create: vi.fn().mockResolvedValue(SAMPLE_TASK),
    list: vi.fn().mockResolvedValue(SAMPLE_LIST),
    get: vi.fn().mockResolvedValue(SAMPLE_TASK),
    update: vi.fn().mockResolvedValue(SAMPLE_TASK),
    assign: vi.fn().mockResolvedValue({ ...SAMPLE_TASK, assigneeId: 'user-2' }),
    changeStatus: vi.fn().mockResolvedValue({ ...SAMPLE_TASK, status: TaskStatus.IN_PROGRESS }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createTaskController', () => {
  let taskUseCases: TaskUseCases;
  let controller: ReturnType<typeof createTaskController>;

  beforeEach(() => {
    taskUseCases = createMockTaskUseCases();
    controller = createTaskController({ taskUseCases });
  });

  describe('create', () => {
    it('returns 201 with the use case result and passes authenticated userId from token claims', async () => {
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: {
            title: 'New Task',
            description: 'Notes',
            status: TaskStatus.IN_PROGRESS,
            assigneeId: 'user-2',
          },
          userId: 'token-user',
        }),
        reply,
      );

      expect(taskUseCases.create).toHaveBeenCalledOnce();
      expect(taskUseCases.create).toHaveBeenCalledWith({
        userId: 'token-user',
        projectId: 'project-1',
        title: 'New Task',
        description: 'Notes',
        status: TaskStatus.IN_PROGRESS,
        assigneeId: 'user-2',
      });
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(SAMPLE_TASK);
    });

    it('maps validation errors to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: '' },
        }),
        reply,
      );

      expect(taskUseCases.create).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('maps ProjectNotFoundError to 404', async () => {
      vi.mocked(taskUseCases.create).mockRejectedValueOnce(new ProjectNotFoundError());
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'missing-project' },
          body: { title: 'Task' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          code: 'PROJECT_NOT_FOUND',
        }),
      );
    });

    it('maps ProjectOwnershipError to 403', async () => {
      vi.mocked(taskUseCases.create).mockRejectedValueOnce(new ProjectOwnershipError());
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: 'Task' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          error: 'Forbidden',
          code: 'PROJECT_OWNERSHIP',
        }),
      );
    });

    it('creates with title only and omits optional fields from the use case input', async () => {
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: 'Minimal Task' },
        }),
        reply,
      );

      expect(taskUseCases.create).toHaveBeenCalledWith({
        userId: 'user-1',
        projectId: 'project-1',
        title: 'Minimal Task',
      });
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(SAMPLE_TASK);
    });

    it('maps InvalidTaskTitleError to 422', async () => {
      vi.mocked(taskUseCases.create).mockRejectedValueOnce(new InvalidTaskTitleError());
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: 'Task' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'TASK_INVALID_TITLE',
        }),
      );
    });

    it('maps unexpected errors to 500', async () => {
      vi.mocked(taskUseCases.create).mockRejectedValueOnce(new Error('database unavailable'));
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: 'Task' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Internal Server Error',
        }),
      );
    });

    it('maps empty project id param to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: '' },
          body: { title: 'Task' },
        }),
        reply,
      );

      expect(taskUseCases.create).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('maps InvalidTaskDescriptionError to 422', async () => {
      vi.mocked(taskUseCases.create).mockRejectedValueOnce(new InvalidTaskDescriptionError());
      const reply = createMockReply();

      await controller.create(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          body: { title: 'Task', description: 'bad' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'TASK_INVALID_DESCRIPTION',
        }),
      );
    });
  });

  describe('list', () => {
    it('returns 200 with listed tasks for the authenticated owner', async () => {
      const reply = createMockReply();

      await controller.list(
        createAuthenticatedRequest({
          params: { id: 'project-1' },
          userId: 'owner-user',
        }),
        reply,
      );

      expect(taskUseCases.list).toHaveBeenCalledOnce();
      expect(taskUseCases.list).toHaveBeenCalledWith({
        userId: 'owner-user',
        projectId: 'project-1',
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(SAMPLE_LIST);
    });

    it('maps missing project id param to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.list(createAuthenticatedRequest({ params: { id: '' } }), reply);

      expect(taskUseCases.list).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('maps ProjectNotFoundError to 404', async () => {
      vi.mocked(taskUseCases.list).mockRejectedValueOnce(new ProjectNotFoundError());
      const reply = createMockReply();

      await controller.list(
        createAuthenticatedRequest({ params: { id: 'missing-project' } }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PROJECT_NOT_FOUND',
        }),
      );
    });

    it('maps ProjectOwnershipError to 403', async () => {
      vi.mocked(taskUseCases.list).mockRejectedValueOnce(new ProjectOwnershipError());
      const reply = createMockReply();

      await controller.list(createAuthenticatedRequest({ params: { id: 'project-1' } }), reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PROJECT_OWNERSHIP',
        }),
      );
    });
  });

  describe('get', () => {
    it('returns 200 with the task DTO', async () => {
      const reply = createMockReply();

      await controller.get(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          userId: 'owner-user',
        }),
        reply,
      );

      expect(taskUseCases.get).toHaveBeenCalledOnce();
      expect(taskUseCases.get).toHaveBeenCalledWith({
        userId: 'owner-user',
        taskId: 'task-1',
      });
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith(SAMPLE_TASK);
    });

    it('maps TaskNotFoundError to 404', async () => {
      vi.mocked(taskUseCases.get).mockRejectedValueOnce(new TaskNotFoundError());
      const reply = createMockReply();

      await controller.get(
        createAuthenticatedRequest({ params: { id: 'missing-task' } }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_NOT_FOUND',
        }),
      );
    });

    it('maps UnauthorizedTaskAccessError to 403', async () => {
      vi.mocked(taskUseCases.get).mockRejectedValueOnce(new UnauthorizedTaskAccessError());
      const reply = createMockReply();

      await controller.get(createAuthenticatedRequest({ params: { id: 'task-1' } }), reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_UNAUTHORIZED',
        }),
      );
    });

    it('maps invalid task id param to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.get(createAuthenticatedRequest({ params: { id: '' } }), reply);

      expect(taskUseCases.get).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });
  });

  describe('update', () => {
    it('routes a single-field assigneeId body to assign', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { assigneeId: 'user-2' },
        }),
        reply,
      );

      expect(taskUseCases.assign).toHaveBeenCalledOnce();
      expect(taskUseCases.assign).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        assigneeId: 'user-2',
      });
      expect(taskUseCases.changeStatus).not.toHaveBeenCalled();
      expect(taskUseCases.update).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('routes a single-field null assigneeId body to assign for unassignment', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { assigneeId: null },
        }),
        reply,
      );

      expect(taskUseCases.assign).toHaveBeenCalledOnce();
      expect(taskUseCases.assign).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        assigneeId: null,
      });
      expect(taskUseCases.update).not.toHaveBeenCalled();
    });

    it('routes a single-field status body to changeStatus', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { status: TaskStatus.DONE },
        }),
        reply,
      );

      expect(taskUseCases.changeStatus).toHaveBeenCalledOnce();
      expect(taskUseCases.changeStatus).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        status: TaskStatus.DONE,
      });
      expect(taskUseCases.assign).not.toHaveBeenCalled();
      expect(taskUseCases.update).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(200);
    });

    it('routes multi-field bodies to update', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: {
            title: 'Updated Title',
            status: TaskStatus.IN_PROGRESS,
          },
        }),
        reply,
      );

      expect(taskUseCases.update).toHaveBeenCalledOnce();
      expect(taskUseCases.update).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        title: 'Updated Title',
        status: TaskStatus.IN_PROGRESS,
      });
      expect(taskUseCases.assign).not.toHaveBeenCalled();
      expect(taskUseCases.changeStatus).not.toHaveBeenCalled();
    });

    it('routes a single title-only body to update', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { title: 'Renamed Task' },
        }),
        reply,
      );

      expect(taskUseCases.update).toHaveBeenCalledOnce();
      expect(taskUseCases.update).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        title: 'Renamed Task',
      });
    });

    it('routes a single description-only body to update', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { description: 'Revised notes' },
        }),
        reply,
      );

      expect(taskUseCases.update).toHaveBeenCalledOnce();
      expect(taskUseCases.update).toHaveBeenCalledWith({
        userId: 'user-1',
        taskId: 'task-1',
        description: 'Revised notes',
      });
      expect(taskUseCases.assign).not.toHaveBeenCalled();
      expect(taskUseCases.changeStatus).not.toHaveBeenCalled();
    });

    it('maps invalid task id param to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: '' },
          body: { title: 'Updated' },
        }),
        reply,
      );

      expect(taskUseCases.update).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('maps invalid status enum in body to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { status: 'not-a-status' },
        }),
        reply,
      );

      expect(taskUseCases.changeStatus).not.toHaveBeenCalled();
      expect(taskUseCases.update).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('rejects an empty update body with 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: {},
        }),
        reply,
      );

      expect(taskUseCases.update).not.toHaveBeenCalled();
      expect(taskUseCases.assign).not.toHaveBeenCalled();
      expect(taskUseCases.changeStatus).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'At least one field must be provided for update',
        }),
      );
    });

    it('maps InvalidTaskTitleError from update to 422', async () => {
      vi.mocked(taskUseCases.update).mockRejectedValueOnce(new InvalidTaskTitleError());
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { title: 'Bad' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_INVALID_TITLE',
        }),
      );
    });

    it('maps TaskNotFoundError from assign to 404', async () => {
      vi.mocked(taskUseCases.assign).mockRejectedValueOnce(new TaskNotFoundError());
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'missing-task' },
          body: { assigneeId: 'user-2' },
        }),
        reply,
      );

      expect(taskUseCases.assign).toHaveBeenCalledOnce();
      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_NOT_FOUND',
        }),
      );
    });

    it('maps InvalidTaskStatusError from changeStatus to 422', async () => {
      vi.mocked(taskUseCases.changeStatus).mockRejectedValueOnce(new InvalidTaskStatusError());
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { status: TaskStatus.DONE },
        }),
        reply,
      );

      expect(taskUseCases.changeStatus).toHaveBeenCalledOnce();
      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_INVALID_STATUS',
        }),
      );
    });

    it('maps UnauthorizedTaskAccessError from update to 403', async () => {
      vi.mocked(taskUseCases.update).mockRejectedValueOnce(new UnauthorizedTaskAccessError());
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { title: 'Updated' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_UNAUTHORIZED',
        }),
      );
    });

    it('maps InvalidTaskDescriptionError from update to 422', async () => {
      vi.mocked(taskUseCases.update).mockRejectedValueOnce(new InvalidTaskDescriptionError());
      const reply = createMockReply();

      await controller.update(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          body: { description: 'bad' },
        }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(422);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_INVALID_DESCRIPTION',
        }),
      );
    });
  });

  describe('delete', () => {
    it('returns 204 after successful deletion', async () => {
      const reply = createMockReply();

      await controller.delete(
        createAuthenticatedRequest({
          params: { id: 'task-1' },
          userId: 'owner-user',
        }),
        reply,
      );

      expect(taskUseCases.delete).toHaveBeenCalledOnce();
      expect(taskUseCases.delete).toHaveBeenCalledWith({
        userId: 'owner-user',
        taskId: 'task-1',
      });
      expect(reply.status).toHaveBeenCalledWith(204);
      expect(reply.send).toHaveBeenCalledWith();
    });

    it('maps TaskNotFoundError to 404', async () => {
      vi.mocked(taskUseCases.delete).mockRejectedValueOnce(new TaskNotFoundError());
      const reply = createMockReply();

      await controller.delete(
        createAuthenticatedRequest({ params: { id: 'missing-task' } }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_NOT_FOUND',
        }),
      );
    });

    it('maps UnauthorizedTaskAccessError to 403', async () => {
      vi.mocked(taskUseCases.delete).mockRejectedValueOnce(new UnauthorizedTaskAccessError());
      const reply = createMockReply();

      await controller.delete(
        createAuthenticatedRequest({ params: { id: 'task-1' } }),
        reply,
      );

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TASK_UNAUTHORIZED',
        }),
      );
    });

    it('maps invalid task id param to 400 VALIDATION_ERROR', async () => {
      const reply = createMockReply();

      await controller.delete(createAuthenticatedRequest({ params: { id: '' } }), reply);

      expect(taskUseCases.delete).not.toHaveBeenCalled();
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });
  });
});
