/**
 * Unit tests for createInMemoryTaskRepository.findByProjectId (project-scoped listing).
 * No database required — uses an isolated in-memory Map per test.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
import {
  createTestTask,
  defaultProjectId,
  otherProjectId,
  reconstituteTestTask,
} from './in-memory-task-repository.test-helpers.js';
import type { TaskRepository } from './types.js';

describe('createInMemoryTaskRepository.findByProjectId', () => {
  let repository: TaskRepository;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
  });

  it('returns an empty array when no tasks exist for the project', async () => {
    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toEqual([]);
  });

  it('returns only tasks belonging to the requested projectId', async () => {
    const inProject = createTestTask({
      id: 'task-in-project',
      title: 'In project',
      projectId: defaultProjectId,
    });
    const elsewhere = createTestTask({
      id: 'task-elsewhere',
      title: 'Elsewhere',
      projectId: otherProjectId,
    });

    await repository.save(inProject);
    await repository.save(elsewhere);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe('task-in-project');
    expect(tasks.every((task) => task.isInProject(defaultProjectId))).toBe(true);
  });

  it('maps every stored task in the project to domain Tasks', async () => {
    const first = createTestTask({
      id: 'task-a',
      status: TaskStatus.TODO,
      projectId: defaultProjectId,
    });
    const second = createTestTask({
      id: 'task-b',
      status: TaskStatus.IN_PROGRESS,
      projectId: defaultProjectId,
    });
    const third = createTestTask({
      id: 'task-c',
      status: TaskStatus.DONE,
      projectId: defaultProjectId,
    });

    await repository.save(first);
    await repository.save(second);
    await repository.save(third);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => task.id).sort()).toEqual(['task-a', 'task-b', 'task-c']);
    expect(tasks.every((task) => task.projectId === defaultProjectId)).toBe(true);
  });

  it('does not apply user or owner filters — only projectId scoping', async () => {
    const unassigned = createTestTask({
      id: 'task-unassigned',
      projectId: defaultProjectId,
      assigneeId: null,
    });
    const assigned = createTestTask({
      id: 'task-assigned',
      projectId: defaultProjectId,
    });

    await repository.save(unassigned);
    await repository.save(assigned);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks).toHaveLength(2);
    expect(tasks.some((task) => task.assigneeId === null)).toBe(true);
    expect(tasks.some((task) => task.assigneeId !== null)).toBe(true);
  });

  it('orders tasks by updatedAt descending', async () => {
    const older = reconstituteTestTask({
      id: 'task-older',
      projectId: defaultProjectId,
      updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    });
    const newer = reconstituteTestTask({
      id: 'task-newer',
      projectId: defaultProjectId,
      updatedAt: new Date('2025-06-02T00:00:00.000Z'),
    });

    await repository.save(older);
    await repository.save(newer);

    const tasks = await repository.findByProjectId(defaultProjectId);

    expect(tasks.map((task) => task.id)).toEqual(['task-newer', 'task-older']);
    expect(tasks[0]?.updatedAt.getTime()).toBeGreaterThan(
      tasks[1]?.updatedAt.getTime() ?? 0,
    );
  });

  it('returns an empty array when tasks exist only in other projects', async () => {
    await repository.save(
      createTestTask({
        id: 'task-other-only',
        projectId: otherProjectId,
      }),
    );

    expect(await repository.findByProjectId(defaultProjectId)).toEqual([]);
  });
});
