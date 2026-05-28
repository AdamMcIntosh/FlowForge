/**
 * Unit tests for PrismaTaskRepository.findById.
 * No database required — Prisma client is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';
import { createPrismaTaskRepository } from './task-repository.js';
import {
  createMockPrismaClient,
  createTaskRecord,
  defaultProjectId,
  otherProjectId,
} from './task-repository.test-helpers.js';

describe('PrismaTaskRepository.findById', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  it('queries prisma.task.findUnique by id only', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

    await repository.findById('task-lookup');

    expect(prisma.task.findUnique).toHaveBeenCalledOnce();
    expect(prisma.task.findUnique).toHaveBeenCalledWith({
      where: { id: 'task-lookup' },
    });
  });

  it('returns null when no record exists', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

    const result = await repository.findById('missing-task');

    expect(result).toBeNull();
  });

  it('returns the mapped domain Task when a record exists', async () => {
    const record = createTaskRecord({
      id: 'task-found',
      title: 'Found task',
      status: TaskStatus.DONE,
    });

    vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

    const task = await repository.findById(record.id);

    expect(task).not.toBeNull();
    expect(task!.id).toBe('task-found');
    expect(task!.title).toBe('Found task');
    expect(task!.status).toBe(TaskStatus.DONE);
    expect(task!.projectId).toBe(defaultProjectId);
  });

  it('does not filter by projectId — returns any task matching the id', async () => {
    const record = createTaskRecord({
      id: 'task-other-project',
      projectId: otherProjectId,
    });

    vi.mocked(prisma.task.findUnique).mockResolvedValue(record);

    const task = await repository.findById(record.id);

    expect(prisma.task.findUnique).toHaveBeenCalledWith({
      where: { id: record.id },
    });
    expect(task!.projectId).toBe(otherProjectId);
  });

  it('propagates prisma.task.findUnique failures to the caller', async () => {
    vi.mocked(prisma.task.findUnique).mockRejectedValue(new Error('Connection lost'));

    await expect(repository.findById('task-error')).rejects.toThrow('Connection lost');
  });
});
