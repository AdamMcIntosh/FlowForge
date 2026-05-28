/**
 * Unit tests for createInMemoryTaskRepository.delete.
 * No database required — uses an isolated in-memory Map per test.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
import {
  createTestTask,
  defaultProjectId,
  otherProjectId,
} from './in-memory-task-repository.test-helpers.js';
import type { TaskRepository } from './types.js';

describe('createInMemoryTaskRepository.delete', () => {
  let repository: TaskRepository;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
  });

  it('removes the task so subsequent findById returns null', async () => {
    const task = createTestTask({
      id: 'task-to-delete',
      title: 'Delete me',
    });

    await repository.save(task);
    await repository.delete(task.id);

    expect(await repository.findById(task.id)).toBeNull();
  });

  it('does not scope delete by projectId — authorization is enforced above the repository', async () => {
    const task = createTestTask({
      id: 'task-any-project',
      projectId: otherProjectId,
    });

    await repository.save(task);
    await repository.delete(task.id);

    expect(await repository.findById(task.id)).toBeNull();
    expect(await repository.findByProjectId(otherProjectId)).toEqual([]);
  });

  it('resolves without a return value on success', async () => {
    const task = createTestTask({ id: 'task-gone' });

    await repository.save(task);

    await expect(repository.delete(task.id)).resolves.toBeUndefined();
  });

  it('does not throw when deleting a task id that was never saved', async () => {
    await expect(repository.delete('missing-task')).resolves.toBeUndefined();
  });

  it('leaves other tasks untouched when deleting one id', async () => {
    const keep = createTestTask({
      id: 'task-keep',
      projectId: defaultProjectId,
    });
    const remove = createTestTask({
      id: 'task-remove',
      projectId: defaultProjectId,
    });

    await repository.save(keep);
    await repository.save(remove);
    await repository.delete(remove.id);

    expect(await repository.findById(keep.id)).not.toBeNull();
    expect(await repository.findById(remove.id)).toBeNull();
    expect(await repository.findByProjectId(defaultProjectId)).toHaveLength(1);
  });
});
