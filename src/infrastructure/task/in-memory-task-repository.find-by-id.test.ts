/**
 * Unit tests for createInMemoryTaskRepository.findById.
 * No database required — uses an isolated in-memory Map per test.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
import {
  createTestTask,
  defaultProjectId,
  otherProjectId,
} from './in-memory-task-repository.test-helpers.js';
import type { TaskRepository } from './types.js';

describe('createInMemoryTaskRepository.findById', () => {
  let repository: TaskRepository;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
  });

  it('returns null when no task exists for the id', async () => {
    const result = await repository.findById('missing-task');

    expect(result).toBeNull();
  });

  it('returns the stored domain Task when a matching id exists', async () => {
    const task = createTestTask({
      id: 'task-found',
      title: 'Found task',
      status: TaskStatus.DONE,
    });

    await repository.save(task);

    const found = await repository.findById('task-found');

    expect(found).not.toBeNull();
    expect(found!.toProps()).toEqual(task.toProps());
  });

  it('returns the same entity reference that was saved', async () => {
    const task = createTestTask({ id: 'task-reference' });

    await repository.save(task);

    const found = await repository.findById(task.id);

    expect(found).toBe(task);
  });

  it('does not filter by projectId — returns any task matching the id', async () => {
    const task = createTestTask({
      id: 'task-other-project',
      projectId: otherProjectId,
    });

    await repository.save(task);

    const found = await repository.findById(task.id);

    expect(found!.projectId).toBe(otherProjectId);
    expect(found!.isInProject(defaultProjectId)).toBe(false);
  });

  it('returns null after the task has been deleted', async () => {
    const task = createTestTask({ id: 'task-deleted' });

    await repository.save(task);
    await repository.delete(task.id);

    expect(await repository.findById(task.id)).toBeNull();
  });
});
