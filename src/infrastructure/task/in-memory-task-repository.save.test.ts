/**
 * Unit tests for createInMemoryTaskRepository.save.
 * No database required — uses an isolated in-memory Map per test.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
import {
  assigneeId,
  createTestTask,
  defaultProjectId,
  otherProjectId,
} from './in-memory-task-repository.test-helpers.js';
import type { TaskRepository } from './types.js';

describe('createInMemoryTaskRepository.save', () => {
  let repository: TaskRepository;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
  });

  it('stores the task and returns the same domain entity', async () => {
    const task = createTestTask({
      id: 'task-save-return',
      title: 'Persisted task',
    });

    const saved = await repository.save(task);

    expect(saved).toBe(task);
    expect(saved.toProps()).toEqual(task.toProps());
  });

  it('persists all task props from the domain entity', async () => {
    const task = createTestTask({
      id: 'task-save-full',
      title: 'New task',
      description: 'Details',
      status: TaskStatus.IN_PROGRESS,
      projectId: defaultProjectId,
      assigneeId,
      createdAt: new Date('2025-06-01T10:00:00.000Z'),
    });

    await repository.save(task);

    const stored = await repository.findById(task.id);

    expect(stored).not.toBeNull();
    expect(stored!.toProps()).toEqual(task.toProps());
  });

  it('persists the provided projectId without modification', async () => {
    const task = createTestTask({
      id: 'task-save-project',
      title: 'Project scoped',
      projectId: otherProjectId,
    });

    const saved = await repository.save(task);

    expect(saved.projectId).toBe(otherProjectId);
    expect((await repository.findById(task.id))!.projectId).toBe(otherProjectId);
  });

  it('overwrites an existing entry when saving the same task id again', async () => {
    const original = createTestTask({
      id: 'task-save-overwrite',
      title: 'Original',
    });
    const replacement = original.update({ title: 'Replacement' });

    await repository.save(original);
    await repository.save(replacement);

    const stored = await repository.findById('task-save-overwrite');

    expect(stored!.title).toBe('Replacement');
    expect(stored!.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
  });
});
