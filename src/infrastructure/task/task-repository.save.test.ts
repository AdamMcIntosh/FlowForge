/**
 * Unit tests for PrismaTaskRepository.save.
 * No database required — Prisma client is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';
import { Task } from '../../domain/task/task.js';
import { createPrismaTaskRepository } from './task-repository.js';
import {
  assigneeId,
  createMockPrismaClient,
  createTaskRecord,
  defaultProjectId,
  echoCreateFromData,
  otherProjectId,
} from './task-repository.test-helpers.js';

describe('PrismaTaskRepository.save', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  it('calls prisma.task.create with all task props from the domain entity', async () => {
    const task = Task.create({
      id: 'task-save-full',
      title: 'New task',
      description: 'Details',
      status: TaskStatus.IN_PROGRESS,
      projectId: defaultProjectId,
      assigneeId,
      createdAt: new Date('2025-06-01T10:00:00.000Z'),
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

    expect(prisma.task.create).toHaveBeenCalledOnce();
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: TaskStatus.IN_PROGRESS,
        projectId: defaultProjectId,
        assigneeId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  });

  it('returns the mapped domain Task from the persistence record', async () => {
    const task = Task.create({
      id: 'task-save-return',
      title: 'Persisted task',
      projectId: defaultProjectId,
    });
    const record = createTaskRecord({
      id: task.id,
      title: task.title,
      description: null,
      status: TaskStatus.TODO,
      assigneeId: null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });

    vi.mocked(prisma.task.create).mockResolvedValue(record);

    const saved = await repository.save(task);

    expect(saved.id).toBe(record.id);
    expect(saved.title).toBe(record.title);
    expect(saved.projectId).toBe(record.projectId);
    expect(saved.toProps()).toEqual(task.toProps());
  });

  it('persists the provided projectId without modification', async () => {
    const task = Task.create({
      id: 'task-save-project',
      title: 'Project scoped',
      projectId: otherProjectId,
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
      data: expect.objectContaining({ projectId: otherProjectId }),
    });
    expect(saved.projectId).toBe(otherProjectId);
  });

  it('persists null description and assigneeId when the domain entity has no optional fields', async () => {
    const task = Task.create({
      id: 'task-save-nullables',
      title: 'Minimal task',
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
        description: null,
        assigneeId: null,
      }),
    });
    expect(saved.description).toBeNull();
    expect(saved.assigneeId).toBeNull();
  });

  it('propagates prisma.task.create failures to the caller', async () => {
    const task = Task.create({
      id: 'task-save-fail',
      title: 'Will fail',
      projectId: defaultProjectId,
    });
    const prismaError = new Error('Unique constraint failed');

    vi.mocked(prisma.task.create).mockRejectedValue(prismaError);

    await expect(repository.save(task)).rejects.toThrow('Unique constraint failed');
  });
});
