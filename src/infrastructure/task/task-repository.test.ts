/**
 * Unit tests for PrismaTaskRepository mappers (toPrismaTaskStatus, mapRecordToTask)
 * and Task.toProps round-trip. No database required — Prisma client is mocked.
 */
import type { TaskStatus as PrismaTaskStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidTaskStatusError } from '../../domain/task/errors.js';
import { TASK_STATUSES, TaskStatus } from '../../domain/task/task-status.js';
import { Task } from '../../domain/task/task.js';
import { createPrismaTaskRepository } from './task-repository.js';
import {
  assigneeId,
  createMockPrismaClient,
  createTaskRecord,
  defaultProjectId,
  echoCreateFromData,
} from './task-repository.test-helpers.js';

describe('PrismaTaskRepository mappers', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  describe('toPrismaTaskStatus', () => {
    it.each(TASK_STATUSES)(
      'passes domain status %s unchanged to prisma.task.create',
      async (status) => {
        const task = Task.create({
          id: 'task-status-save',
          title: 'Status save',
          status,
          projectId: defaultProjectId,
        });

        vi.mocked(prisma.task.create).mockImplementation(async ({ data }) =>
          echoCreateFromData({
            id: data.id,
            title: data.title,
            description: data.description,
            status: data.status,
            projectId: data.projectId,
            assigneeId: data.assigneeId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          }),
        );

        await repository.save(task);

        expect(prisma.task.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ status }),
        });
      },
    );

    it.each(TASK_STATUSES)(
      'passes domain status %s unchanged to prisma.task.update',
      async (status) => {
        const task = Task.create({
          id: 'task-status-update',
          title: 'Status update',
          status,
          projectId: defaultProjectId,
        });

        vi.mocked(prisma.task.update).mockImplementation(async ({ data }) =>
          echoCreateFromData({
            id: task.id,
            title: data.title as string,
            description: data.description as string | null,
            status: data.status as PrismaTaskStatus,
            projectId: task.projectId,
            assigneeId: data.assigneeId as string | null,
            createdAt: task.createdAt,
            updatedAt: data.updatedAt as Date,
          }),
        );

        await repository.update(task);

        expect(prisma.task.update).toHaveBeenCalledWith({
          where: { id: task.id },
          data: expect.objectContaining({ status }),
        });
      },
    );
  });

  describe('mapRecordToTask', () => {
    it('maps a full persistence record to a domain Task', async () => {
      const record = createTaskRecord();

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task).not.toBeNull();
      expect(task!.id).toBe(record.id);
      expect(task!.title).toBe(record.title);
      expect(task!.description).toBe(record.description);
      expect(task!.status).toBe(record.status);
      expect(task!.projectId).toBe(record.projectId);
      expect(task!.assigneeId).toBe(record.assigneeId);
      expect(task!.createdAt).toBe(record.createdAt);
      expect(task!.updatedAt).toBe(record.updatedAt);
    });

    it('maps null description and assigneeId', async () => {
      const record = createTaskRecord({
        description: null,
        assigneeId: null,
      });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task!.description).toBeNull();
      expect(task!.assigneeId).toBeNull();
    });

    it('applies domain normalization when reconstituting trimmed persistence fields', async () => {
      const record = createTaskRecord({
        title: '  Stored task  ',
        description: '  Stored details  ',
      });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task!.title).toBe('Stored task');
      expect(task!.description).toBe('Stored details');
    });

    it.each(TASK_STATUSES)('maps Prisma status %s to the domain enum', async (status) => {
      const record = createTaskRecord({ status, id: `task-${status}` });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task!.status).toBe(status);
    });

    it('throws InvalidTaskStatusError for an invalid persisted status value', async () => {
      const record = createTaskRecord({
        status: 'BLOCKED' as PrismaTaskStatus,
      });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      await expect(repository.findById(record.id)).rejects.toThrow(InvalidTaskStatusError);
    });

    it('maps every record returned by findByProjectId', async () => {
      const records = [
        createTaskRecord({ id: 'task-a', status: TaskStatus.TODO }),
        createTaskRecord({ id: 'task-b', status: TaskStatus.IN_PROGRESS }),
        createTaskRecord({ id: 'task-c', status: TaskStatus.DONE }),
      ];

      vi.mocked(prisma.task.findMany).mockResolvedValue(records);

      const tasks = await repository.findByProjectId(defaultProjectId);

      expect(tasks).toHaveLength(3);
      expect(tasks.map((task) => task.id)).toEqual(['task-a', 'task-b', 'task-c']);
      expect(tasks.map((task) => task.status)).toEqual([
        TaskStatus.TODO,
        TaskStatus.IN_PROGRESS,
        TaskStatus.DONE,
      ]);
    });
  });

  describe('mapRecordToTask and toProps round-trip', () => {
    it('save round-trip preserves task props after domain ↔ persistence mapping', async () => {
      const task = Task.create({
        id: 'task-round-trip-save',
        title: 'Round trip',
        description: 'Details',
        status: TaskStatus.IN_PROGRESS,
        projectId: defaultProjectId,
        assigneeId,
        createdAt: new Date('2025-03-01T12:00:00.000Z'),
      });

      vi.mocked(prisma.task.create).mockImplementation(async ({ data }) =>
        echoCreateFromData({
          id: data.id,
          title: data.title,
          description: data.description,
          status: data.status,
          projectId: data.projectId,
          assigneeId: data.assigneeId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        }),
      );

      const saved = await repository.save(task);

      expect(saved.toProps()).toEqual(task.toProps());
    });

    it('update round-trip preserves updated task props', async () => {
      const original = Task.create({
        id: 'task-round-trip-update',
        title: 'Original',
        description: 'Before',
        status: TaskStatus.TODO,
        projectId: defaultProjectId,
        assigneeId: null,
        createdAt: new Date('2025-03-01T12:00:00.000Z'),
      });
      const updated = original.update({
        title: 'Updated',
        description: 'After',
        status: TaskStatus.DONE,
        assigneeId,
      });

      vi.mocked(prisma.task.update).mockImplementation(async ({ data }) =>
        echoCreateFromData({
          id: updated.id,
          title: data.title as string,
          description: data.description as string | null,
          status: data.status as PrismaTaskStatus,
          projectId: updated.projectId,
          assigneeId: data.assigneeId as string | null,
          createdAt: updated.createdAt,
          updatedAt: data.updatedAt as Date,
        }),
      );

      const persisted = await repository.update(updated);

      expect(persisted.toProps()).toEqual(updated.toProps());
    });

    it('findById round-trip produces normalized props from a persistence record', async () => {
      const record = createTaskRecord({
        title: '  Persisted title  ',
        description: '  Persisted description  ',
        status: TaskStatus.DONE,
      });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task!.toProps()).toEqual({
        id: record.id,
        title: 'Persisted title',
        description: 'Persisted description',
        status: TaskStatus.DONE,
        projectId: record.projectId,
        assigneeId: record.assigneeId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    });

    it('save round-trip normalizes whitespace before persistence and after reconstitution', async () => {
      const task = Task.create({
        id: 'task-normalized-round-trip',
        title: '  Trimmed title  ',
        description: '  Trimmed description  ',
        status: TaskStatus.TODO,
        projectId: defaultProjectId,
      });

      vi.mocked(prisma.task.create).mockImplementation(async ({ data }) =>
        echoCreateFromData({
          id: data.id,
          title: data.title,
          description: data.description,
          status: data.status,
          projectId: data.projectId,
          assigneeId: data.assigneeId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        }),
      );

      const saved = await repository.save(task);

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Trimmed title',
          description: 'Trimmed description',
        }),
      });
      expect(saved.toProps()).toEqual(task.toProps());
    });
  });
});
