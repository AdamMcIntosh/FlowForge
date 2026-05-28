/**
 * Unit tests for PrismaTaskRepository.update.
 * No database required — Prisma client is mocked.
 */
import type { TaskStatus as PrismaTaskStatus } from '@prisma/client';
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

describe('PrismaTaskRepository.update', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  it('calls prisma.task.update with mutable fields only', async () => {
    const original = Task.create({
      id: 'task-update',
      title: 'Original',
      description: 'Before',
      status: TaskStatus.TODO,
      projectId: defaultProjectId,
      assigneeId: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const updated = original.update({
      title: 'Updated',
      description: 'After',
      status: TaskStatus.IN_PROGRESS,
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

    await repository.update(updated);

    expect(prisma.task.update).toHaveBeenCalledOnce();
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: updated.id },
      data: {
        title: 'Updated',
        description: 'After',
        status: TaskStatus.IN_PROGRESS,
        assigneeId,
        updatedAt: updated.updatedAt,
      },
    });
  });

  it('does not include projectId in the update payload — project association is immutable', async () => {
    const task = Task.create({
      id: 'task-immutable-project',
      title: 'Scoped task',
      projectId: defaultProjectId,
    }).update({ title: 'Renamed' });

    vi.mocked(prisma.task.update).mockImplementation(async ({ data }) =>
      echoCreateFromData({
        id: task.id,
        title: data.title as string,
        description: data.description as string | null,
        status: data.status as PrismaTaskStatus,
        projectId: otherProjectId,
        assigneeId: data.assigneeId as string | null,
        createdAt: task.createdAt,
        updatedAt: data.updatedAt as Date,
      }),
    );

    const result = await repository.update(task);

    const updateData = vi.mocked(prisma.task.update).mock.calls[0]?.[0]?.data;
    expect(updateData).not.toHaveProperty('projectId');
    expect(result.projectId).toBe(otherProjectId);
  });

  it('returns the mapped domain Task from the updated record', async () => {
    const task = Task.create({
      id: 'task-update-return',
      title: 'Before',
      projectId: defaultProjectId,
    }).update({ title: 'After', status: TaskStatus.DONE });

    const record = createTaskRecord({
      id: task.id,
      title: 'After',
      status: TaskStatus.DONE,
      updatedAt: task.updatedAt,
    });

    vi.mocked(prisma.task.update).mockResolvedValue(record);

    const result = await repository.update(task);

    expect(result.title).toBe('After');
    expect(result.status).toBe(TaskStatus.DONE);
    expect(result.id).toBe(task.id);
    expect(result.projectId).toBe(task.projectId);
    expect(result.updatedAt).toBe(record.updatedAt);
    expect(result.description).toBe(record.description);
    expect(result.assigneeId).toBe(record.assigneeId);
    expect(result.createdAt).toBe(record.createdAt);
  });

  it('does not include createdAt in the update payload — creation timestamp is immutable', async () => {
    const task = Task.create({
      id: 'task-immutable-created-at',
      title: 'Original',
      projectId: defaultProjectId,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    }).update({ title: 'Renamed' });

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

    const updateData = vi.mocked(prisma.task.update).mock.calls[0]?.[0]?.data;
    expect(updateData).not.toHaveProperty('createdAt');
  });

  it('persists null assigneeId when clearing assignment', async () => {
    const task = Task.create({
      id: 'task-unassign',
      title: 'Assigned',
      projectId: defaultProjectId,
      assigneeId,
    }).update({ assigneeId: null });

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

    const result = await repository.update(task);

    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: task.id },
      data: expect.objectContaining({ assigneeId: null }),
    });
    expect(result.assigneeId).toBeNull();
  });

  it('propagates prisma.task.update failures to the caller', async () => {
    const task = Task.create({
      id: 'task-update-fail',
      title: 'Missing',
      projectId: defaultProjectId,
    });

    vi.mocked(prisma.task.update).mockRejectedValue(new Error('Record not found'));

    await expect(repository.update(task)).rejects.toThrow('Record not found');
  });
});
