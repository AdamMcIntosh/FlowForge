/**
 * Unit tests for PrismaTaskRepository.findByProjectId (project-scoped listing).
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

describe('PrismaTaskRepository.findByProjectId', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  it('queries prisma.task.findMany scoped to the requested projectId', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    await repository.findByProjectId(defaultProjectId);

    expect(prisma.task.findMany).toHaveBeenCalledOnce();
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: { projectId: defaultProjectId },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('returns an empty array when prisma returns no records', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toEqual([]);
  });

  it('maps every record in the result set to domain Tasks', async () => {
    const records = [
      createTaskRecord({ id: 'task-a', status: TaskStatus.TODO, projectId: defaultProjectId }),
      createTaskRecord({
        id: 'task-b',
        status: TaskStatus.IN_PROGRESS,
        projectId: defaultProjectId,
      }),
      createTaskRecord({ id: 'task-c', status: TaskStatus.DONE, projectId: defaultProjectId }),
    ];

    vi.mocked(prisma.task.findMany).mockResolvedValue(records);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.id)).toEqual(['task-a', 'task-b', 'task-c']);
    expect(tasks.every((task) => task.projectId === defaultProjectId)).toBe(true);
  });

  it('does not apply user or owner filters — only projectId in the where clause', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([]);

    await repository.findByProjectId(otherProjectId);

    const call = vi.mocked(prisma.task.findMany).mock.calls[0]?.[0];
    expect(call?.where).toEqual({ projectId: otherProjectId });
    expect(call?.where).not.toHaveProperty('ownerId');
    expect(call?.where).not.toHaveProperty('assigneeId');
    expect(call?.where).not.toHaveProperty('userId');
  });

  it('preserves prisma result order (updatedAt desc)', async () => {
    const newer = createTaskRecord({
      id: 'task-newer',
      updatedAt: new Date('2025-06-02T00:00:00.000Z'),
    });
    const older = createTaskRecord({
      id: 'task-older',
      updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    });

    vi.mocked(prisma.task.findMany).mockResolvedValue([newer, older]);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks.map((task) => task.id)).toEqual(['task-newer', 'task-older']);
  });

  it('propagates prisma.task.findMany failures to the caller', async () => {
    vi.mocked(prisma.task.findMany).mockRejectedValue(new Error('Query timeout'));

    await expect(repository.findByProjectId(defaultProjectId)).rejects.toThrow('Query timeout');
  });
});
