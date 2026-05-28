/**
 * Unit tests documenting PrismaTaskRepository authorization boundaries.
 *
 * The repository is intentionally unaware of users and project ownership.
 * Callers (application use cases) must enforce access control after loading
 * tasks or before mutating them. These tests lock in that contract.
 *
 * No database required — Prisma client is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedTaskAccessError } from '../../domain/task/errors.js';
import { TaskStatus } from '../../domain/task/task-status.js';
import { Task } from '../../domain/task/task.js';
import { createPrismaTaskRepository } from './task-repository.js';
import {
  createMockPrismaClient,
  createTaskRecord,
  defaultProjectId,
  otherProjectId,
} from './task-repository.test-helpers.js';

describe('PrismaTaskRepository authorization boundaries', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  describe('findById exposes tasks without ownership checks', () => {
    it('returns a task from any project so callers must verify project ownership', async () => {
      const record = createTaskRecord({
        id: 'task-cross-project',
        projectId: otherProjectId,
      });

      vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

      const task = await repository.findById(record.id);

      expect(task!.projectId).toBe(otherProjectId);
      expect(() => task!.assertAccessibleByProjectOwner('owner-a', 'owner-b')).toThrow(
        UnauthorizedTaskAccessError,
      );
    });
  });

  describe('findByProjectId is the project-scoped listing boundary', () => {
    it('never mixes tasks from different projects in a single query', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        createTaskRecord({ id: 'only-in-project', projectId: defaultProjectId }),
      ]);

      const tasks = await repository.findByProjectId(defaultProjectId);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { projectId: defaultProjectId },
        orderBy: { updatedAt: 'desc' },
      });
      expect(tasks.every((task) => task.isInProject(defaultProjectId))).toBe(true);
    });

    it('allows domain-level project assertion on every returned task', async () => {
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        createTaskRecord({ id: 'task-1', projectId: defaultProjectId }),
        createTaskRecord({ id: 'task-2', projectId: defaultProjectId }),
      ]);

      const tasks = await repository.findByProjectId(defaultProjectId);

      for (const task of tasks) {
        expect(() => task.assertInProject(defaultProjectId)).not.toThrow();
        expect(() => task.assertInProject(otherProjectId)).toThrow(UnauthorizedTaskAccessError);
      }
    });
  });

  describe('save binds tasks to the caller-supplied project', () => {
    it('persists projectId exactly as provided on the domain entity', async () => {
      const task = Task.create({
        id: 'task-bound',
        title: 'Bound to project',
        projectId: otherProjectId,
        status: TaskStatus.TODO,
      });

      vi.mocked(prisma.task.create).mockResolvedValue(
        createTaskRecord({
          id: task.id,
          title: task.title,
          projectId: otherProjectId,
          assigneeId: null,
          description: null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        }),
      );

      const saved = await repository.save(task);

      expect(saved.projectId).toBe(otherProjectId);
      expect(saved.isInProject(otherProjectId)).toBe(true);
    });
  });

  describe('update and delete do not enforce project ownership', () => {
    it('update mutates by task id only — callers must authorize before invoking', async () => {
      const task = Task.create({
        id: 'task-unauthorized-update',
        title: 'Sensitive',
        projectId: otherProjectId,
      }).update({ title: 'Changed' });

      vi.mocked(prisma.task.update).mockResolvedValue(
        createTaskRecord({
          id: task.id,
          title: 'Changed',
          projectId: otherProjectId,
        }),
      );

      await repository.update(task);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: task.id },
        data: expect.not.objectContaining({ projectId: expect.anything() }),
      });
    });

    it('delete removes by task id only — callers must authorize before invoking', async () => {
      vi.mocked(prisma.task.delete).mockResolvedValue({} as never);

      await repository.delete('task-unauthorized-delete');

      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-unauthorized-delete' },
      });
    });
  });
});
