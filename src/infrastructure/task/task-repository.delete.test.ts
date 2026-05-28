/**
 * Unit tests for PrismaTaskRepository.delete.
 * No database required — Prisma client is mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrismaTaskRepository } from './task-repository.js';
import { createMockPrismaClient } from './task-repository.test-helpers.js';

describe('PrismaTaskRepository.delete', () => {
  let prisma: ReturnType<typeof createMockPrismaClient>;
  let repository: ReturnType<typeof createPrismaTaskRepository>;

  beforeEach(() => {
    prisma = createMockPrismaClient();
    repository = createPrismaTaskRepository(prisma);
  });

  it('calls prisma.task.delete with the task id only', async () => {
    vi.mocked(prisma.task.delete).mockResolvedValue({} as never);

    await repository.delete('task-to-delete');

    expect(prisma.task.delete).toHaveBeenCalledOnce();
    expect(prisma.task.delete).toHaveBeenCalledWith({
      where: { id: 'task-to-delete' },
    });
  });

  it('does not scope delete by projectId — authorization is enforced above the repository', async () => {
    vi.mocked(prisma.task.delete).mockResolvedValue({} as never);

    await repository.delete('task-any-project');

    const call = vi.mocked(prisma.task.delete).mock.calls[0]?.[0];
    expect(call?.where).toEqual({ id: 'task-any-project' });
    expect(call?.where).not.toHaveProperty('projectId');
  });

  it('resolves without a return value on success', async () => {
    vi.mocked(prisma.task.delete).mockResolvedValue({} as never);

    await expect(repository.delete('task-gone')).resolves.toBeUndefined();
  });

  it('propagates prisma.task.delete failures to the caller', async () => {
    vi.mocked(prisma.task.delete).mockRejectedValue(new Error('Record not found'));

    await expect(repository.delete('missing-task')).rejects.toThrow('Record not found');
  });
});
