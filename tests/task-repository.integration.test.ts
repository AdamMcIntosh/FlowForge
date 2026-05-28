/**
 * Integration tests for TaskRepository implementations.
 *
 * In-memory (createInMemoryTaskRepository):
 *   - No database required
 *   - CRUD contract, project scoping, and authorization boundaries
 *
 * Prisma (createTestDatabase + createPrismaTaskRepository):
 *   - SQLite via prisma/schema.test.prisma — unique per-test in-memory DB
 *   - Persistence and Prisma enum mapping round-trips only
 */

import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UnauthorizedTaskAccessError } from '../src/domain/task/errors.js';
import { Task } from '../src/domain/task/task.js';
import { TASK_STATUSES, TaskStatus } from '../src/domain/task/task-status.js';
import { createPrismaTaskRepository } from '../src/infrastructure/task/task-repository.js';
import type { TaskRepository } from '../src/infrastructure/task/types.js';
import { createTestDatabase, type TestDatabase } from './helpers/create-test-database.js';
import { createInMemoryTaskRepository } from './helpers/in-memory-task-repository.js';

type SeededUser = {
  id: string;
  email: string;
  name: string;
};

type SeededProject = {
  id: string;
  ownerId: string;
  name: string;
};

async function seedUser(
  prisma: PrismaClient,
  overrides: Partial<SeededUser> = {},
): Promise<SeededUser> {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${id}@example.com`;
  const name = overrides.name ?? 'Test User';

  await prisma.user.create({
    data: {
      id,
      email,
      name,
      password: 'integration-test-password-hash',
    },
  });

  return { id, email, name };
}

async function seedProject(
  prisma: PrismaClient,
  ownerId: string,
  overrides: Partial<Pick<SeededProject, 'id' | 'name'>> = {},
): Promise<SeededProject> {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? 'Test Project';

  await prisma.project.create({
    data: {
      id,
      name,
      ownerId,
    },
  });

  return { id, ownerId, name };
}

describe('TaskRepository via createInMemoryTaskRepository', () => {
  let repository: TaskRepository;
  let projectId: string;
  let otherProjectId: string;
  let assigneeId: string;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
    projectId = randomUUID();
    otherProjectId = randomUUID();
    assigneeId = randomUUID();
  });

  describe('save', () => {
    it('stores a task with all fields and returns the domain entity', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Implement repository tests',
        description: 'Cover save, find, update, delete',
        status: TaskStatus.IN_PROGRESS,
        projectId,
        assigneeId,
      });

      const saved = await repository.save(task);

      expect(saved.toProps()).toEqual(task.toProps());
      expect(await repository.findById(task.id)).not.toBeNull();
    });

    it('defaults status to TODO and description to null when omitted', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Minimal task',
        projectId,
      });

      const saved = await repository.save(task);

      expect(saved.status).toBe(TaskStatus.TODO);
      expect(saved.description).toBeNull();
      expect(saved.assigneeId).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns null when no task exists for the id', async () => {
      expect(await repository.findById(randomUUID())).toBeNull();
    });

    it('returns the persisted task mapped to the domain entity', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Lookup task',
        description: 'Find me',
        status: TaskStatus.DONE,
        projectId,
        assigneeId,
      });
      await repository.save(task);

      const found = await repository.findById(task.id);

      expect(found).not.toBeNull();
      expect(found?.toProps()).toEqual(task.toProps());
    });
  });

  describe('findByProjectId', () => {
    it('returns an empty array when the project has no tasks', async () => {
      expect(await repository.findByProjectId(projectId)).toEqual([]);
    });

    it('returns only tasks belonging to the requested project', async () => {
      const inProject = Task.create({
        id: randomUUID(),
        title: 'In project',
        projectId,
      });
      const elsewhere = Task.create({
        id: randomUUID(),
        title: 'Elsewhere',
        projectId: otherProjectId,
      });

      await repository.save(inProject);
      await repository.save(elsewhere);

      const tasks = await repository.findByProjectId(projectId);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.id).toBe(inProject.id);
      expect(tasks.every((task) => task.isInProject(projectId))).toBe(true);
    });

    it('orders tasks by updatedAt descending', async () => {
      const older = Task.create({
        id: randomUUID(),
        title: 'Older task',
        projectId,
      });
      const newer = Task.create({
        id: randomUUID(),
        title: 'Newer task',
        projectId,
      });

      const savedOlder = await repository.save(older);
      await repository.save(newer);

      const bumpedOlder = savedOlder.update({ title: 'Older task (updated)' });
      await repository.update(bumpedOlder);

      const tasks = await repository.findByProjectId(projectId);

      expect(tasks.map((task) => task.id)).toEqual([bumpedOlder.id, newer.id]);
      expect(tasks[0]?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        tasks[1]?.updatedAt.getTime() ?? 0,
      );
    });
  });

  describe('update', () => {
    it('persists title, description, status, assigneeId, and updatedAt changes', async () => {
      const original = Task.create({
        id: randomUUID(),
        title: 'Original title',
        description: 'Original description',
        status: TaskStatus.TODO,
        projectId,
        assigneeId: null,
      });
      await repository.save(original);

      const updated = original.update({
        title: 'Updated title',
        description: 'Updated description',
        status: TaskStatus.IN_PROGRESS,
        assigneeId,
      });

      const result = await repository.update(updated);

      expect(result.title).toBe('Updated title');
      expect(result.description).toBe('Updated description');
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.assigneeId).toBe(assigneeId);
      expect(result.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
      expect(result.projectId).toBe(projectId);
    });

    it('clears assigneeId when updated to null', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Assigned task',
        projectId,
        assigneeId,
      });
      await repository.save(task);

      const unassigned = task.update({ assigneeId: null });
      const result = await repository.update(unassigned);

      expect(result.assigneeId).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the task so subsequent lookups return null', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Delete me',
        projectId,
      });
      await repository.save(task);

      await repository.delete(task.id);

      expect(await repository.findById(task.id)).toBeNull();
    });
  });

  describe('project association boundaries', () => {
    it('save binds tasks to the caller-supplied projectId', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Bound to project',
        projectId: otherProjectId,
      });

      const saved = await repository.save(task);

      expect(saved.projectId).toBe(otherProjectId);
      expect(saved.isInProject(otherProjectId)).toBe(true);
      expect(saved.isInProject(projectId)).toBe(false);
    });

    it('update does not change projectId — project association is immutable', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Scoped task',
        projectId,
      });
      await repository.save(task);

      const renamed = task.update({ title: 'Renamed' });
      const result = await repository.update(renamed);

      expect(result.projectId).toBe(projectId);
      expect(result.isInProject(projectId)).toBe(true);
    });

    it('findByProjectId never mixes tasks from different projects', async () => {
      const firstProjectTask = Task.create({
        id: randomUUID(),
        title: 'First project',
        projectId,
      });
      const secondProjectTask = Task.create({
        id: randomUUID(),
        title: 'Second project',
        projectId: otherProjectId,
      });

      await repository.save(firstProjectTask);
      await repository.save(secondProjectTask);

      const firstProjectTasks = await repository.findByProjectId(projectId);
      const secondProjectTasks = await repository.findByProjectId(otherProjectId);

      expect(firstProjectTasks).toHaveLength(1);
      expect(secondProjectTasks).toHaveLength(1);
      expect(firstProjectTasks[0]?.id).toBe(firstProjectTask.id);
      expect(secondProjectTasks[0]?.id).toBe(secondProjectTask.id);
    });
  });

  describe('authorization boundaries', () => {
    it('findById returns tasks from any project — callers must verify project ownership', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Cross-project task',
        projectId: otherProjectId,
      });
      await repository.save(task);

      const found = await repository.findById(task.id);

      expect(found!.projectId).toBe(otherProjectId);
      expect(() => found!.assertAccessibleByProjectOwner('owner-a', 'owner-b')).toThrow(
        UnauthorizedTaskAccessError,
      );
    });

    it('findByProjectId allows domain-level project assertion on every returned task', async () => {
      const taskA = Task.create({
        id: randomUUID(),
        title: 'Task A',
        projectId,
      });
      const taskB = Task.create({
        id: randomUUID(),
        title: 'Task B',
        projectId,
      });

      await repository.save(taskA);
      await repository.save(taskB);

      const tasks = await repository.findByProjectId(projectId);

      for (const task of tasks) {
        expect(() => task.assertInProject(projectId)).not.toThrow();
        expect(() => task.assertInProject(otherProjectId)).toThrow(UnauthorizedTaskAccessError);
      }
    });

    it('update mutates by task id only — callers must authorize before invoking', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Sensitive',
        projectId: otherProjectId,
      });
      await repository.save(task);

      const changed = task.update({ title: 'Changed without ownership check' });
      const result = await repository.update(changed);

      expect(result.title).toBe('Changed without ownership check');
      expect(result.projectId).toBe(otherProjectId);
    });

    it('delete removes by task id only — callers must authorize before invoking', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Delete without ownership check',
        projectId: otherProjectId,
      });
      await repository.save(task);

      await repository.delete(task.id);

      expect(await repository.findById(task.id)).toBeNull();
    });
  });
});

describe('createPrismaTaskRepository via createTestDatabase', () => {
  let database: TestDatabase;
  let repository: TaskRepository;
  let projectId: string;
  let assigneeId: string;

  beforeEach(async () => {
    database = createTestDatabase();
    await database.connectDatabase();
    repository = createPrismaTaskRepository(database.prisma);

    const owner = await seedUser(database.prisma);
    const assignee = await seedUser(database.prisma, {
      email: `assignee-${randomUUID()}@example.com`,
      name: 'Assignee User',
    });
    assigneeId = assignee.id;

    const project = await seedProject(database.prisma, owner.id);
    projectId = project.id;
  });

  afterEach(async () => {
    await database.disconnectDatabase();
  });

  describe('save', () => {
    it('persists a task with all fields to SQLite', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Implement repository tests',
        description: 'Cover save, find, update, delete',
        status: TaskStatus.IN_PROGRESS,
        projectId,
        assigneeId,
      });

      const saved = await repository.save(task);

      expect(saved.id).toBe(task.id);
      expect(saved.title).toBe('Implement repository tests');
      expect(saved.description).toBe('Cover save, find, update, delete');
      expect(saved.status).toBe(TaskStatus.IN_PROGRESS);
      expect(saved.projectId).toBe(projectId);
      expect(saved.assigneeId).toBe(assigneeId);

      const row = await database.prisma.task.findUnique({ where: { id: saved.id } });
      expect(row).not.toBeNull();
      expect(row?.status).toBe('IN_PROGRESS');
      expect(row?.assigneeId).toBe(assigneeId);
      expect(row?.projectId).toBe(projectId);
    });

    it('defaults status to TODO and description to null when omitted', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Minimal task',
        projectId,
      });

      const saved = await repository.save(task);

      expect(saved.status).toBe(TaskStatus.TODO);
      expect(saved.description).toBeNull();
      expect(saved.assigneeId).toBeNull();

      const row = await database.prisma.task.findUnique({ where: { id: saved.id } });
      expect(row?.status).toBe('TODO');
      expect(row?.description).toBeNull();
      expect(row?.assigneeId).toBeNull();
    });
  });

  describe('findById', () => {
    it('round-trips a persisted task through Prisma mapping', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Lookup task',
        description: 'Find me',
        status: TaskStatus.DONE,
        projectId,
        assigneeId,
      });
      await repository.save(task);

      const found = await repository.findById(task.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(task.id);
      expect(found?.title).toBe(task.title);
      expect(found?.status).toBe(TaskStatus.DONE);
      expect(found?.projectId).toBe(projectId);
    });
  });

  describe('findByProjectId', () => {
    it('returns only tasks belonging to the requested project from SQLite', async () => {
      const otherOwner = await seedUser(database.prisma, {
        email: `other-owner-${randomUUID()}@example.com`,
      });
      const otherProject = await seedProject(database.prisma, otherOwner.id, {
        name: 'Other Project',
      });

      const inProject = Task.create({
        id: randomUUID(),
        title: 'In project',
        projectId,
      });
      const elsewhere = Task.create({
        id: randomUUID(),
        title: 'Elsewhere',
        projectId: otherProject.id,
      });

      await repository.save(inProject);
      await repository.save(elsewhere);

      const tasks = await repository.findByProjectId(projectId);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.id).toBe(inProject.id);
    });
  });

  describe('update', () => {
    it('persists mutable field changes to SQLite', async () => {
      const original = Task.create({
        id: randomUUID(),
        title: 'Original title',
        description: 'Original description',
        status: TaskStatus.TODO,
        projectId,
        assigneeId: null,
      });
      await repository.save(original);

      const updated = original.update({
        title: 'Updated title',
        description: 'Updated description',
        status: TaskStatus.IN_PROGRESS,
        assigneeId,
      });

      const result = await repository.update(updated);

      expect(result.title).toBe('Updated title');
      expect(result.description).toBe('Updated description');
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.assigneeId).toBe(assigneeId);
      expect(result.projectId).toBe(projectId);

      const row = await database.prisma.task.findUnique({ where: { id: original.id } });
      expect(row?.title).toBe('Updated title');
      expect(row?.description).toBe('Updated description');
      expect(row?.status).toBe('IN_PROGRESS');
      expect(row?.assigneeId).toBe(assigneeId);
      expect(row?.projectId).toBe(projectId);
    });

    it('clears assigneeId in SQLite when updated to null', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Assigned task',
        projectId,
        assigneeId,
      });
      await repository.save(task);

      const unassigned = task.update({ assigneeId: null });
      const result = await repository.update(unassigned);

      expect(result.assigneeId).toBeNull();

      const row = await database.prisma.task.findUnique({ where: { id: task.id } });
      expect(row?.assigneeId).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the task row from SQLite', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Delete me',
        projectId,
      });
      await repository.save(task);

      await repository.delete(task.id);

      expect(await repository.findById(task.id)).toBeNull();
      expect(await database.prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
    });
  });

  describe('TaskStatus enum mapping', () => {
    it.each(TASK_STATUSES)(
      'round-trips status %s through save and findById',
      async (status) => {
        const task = Task.create({
          id: randomUUID(),
          title: `Task with status ${status}`,
          projectId,
          status,
        });

        const saved = await repository.save(task);
        expect(saved.status).toBe(status);

        const found = await repository.findById(task.id);
        expect(found?.status).toBe(status);

        const row = await database.prisma.task.findUnique({ where: { id: task.id } });
        expect(row?.status).toBe(status);
      },
    );

    it('persists status transitions through update for every enum value', async () => {
      const task = Task.create({
        id: randomUUID(),
        title: 'Status transitions',
        projectId,
        status: TaskStatus.TODO,
      });
      await repository.save(task);

      for (const status of TASK_STATUSES) {
        const updated = (await repository.findById(task.id))!.update({ status });
        const result = await repository.update(updated);

        expect(result.status).toBe(status);

        const row = await database.prisma.task.findUnique({ where: { id: task.id } });
        expect(row?.status).toBe(status);
      }
    });
  });
});
