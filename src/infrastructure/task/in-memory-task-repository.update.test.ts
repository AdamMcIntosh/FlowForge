/**
 * Unit tests for createInMemoryTaskRepository.update.
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

describe('createInMemoryTaskRepository.update', () => {
  let repository: TaskRepository;

  beforeEach(() => {
    repository = createInMemoryTaskRepository();
  });

  it('stores mutable field changes and returns the updated domain entity', async () => {
    const original = createTestTask({
      id: 'task-update',
      title: 'Original',
      description: 'Before',
      status: TaskStatus.TODO,
      assigneeId: null,
    });
    const updated = original.update({
      title: 'Updated',
      description: 'After',
      status: TaskStatus.IN_PROGRESS,
      assigneeId,
    });

    await repository.save(original);
    const result = await repository.update(updated);

    expect(result).toBe(updated);
    expect(result.title).toBe('Updated');
    expect(result.description).toBe('After');
    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.assigneeId).toBe(assigneeId);
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
  });

  it('persists changes so findById returns the updated task', async () => {
    const original = createTestTask({
      id: 'task-update-persist',
      title: 'Before',
    });

    await repository.save(original);

    const updated = original.update({ title: 'After', status: TaskStatus.DONE });
    await repository.update(updated);

    const stored = await repository.findById('task-update-persist');

    expect(stored!.title).toBe('After');
    expect(stored!.status).toBe(TaskStatus.DONE);
    expect(stored!.toProps()).toEqual(updated.toProps());
  });

  it('preserves projectId — project association is immutable at the domain layer', async () => {
    const original = createTestTask({
      id: 'task-immutable-project',
      title: 'Scoped task',
      projectId: defaultProjectId,
    });

    await repository.save(original);

    const renamed = original.update({ title: 'Renamed' });
    const result = await repository.update(renamed);

    expect(result.projectId).toBe(defaultProjectId);
    expect(result.isInProject(otherProjectId)).toBe(false);
  });

  it('clears assigneeId when updated to null', async () => {
    const task = createTestTask({
      id: 'task-unassign',
      assigneeId,
    });

    await repository.save(task);

    const unassigned = task.update({ assigneeId: null });
    const result = await repository.update(unassigned);

    expect(result.assigneeId).toBeNull();
    expect((await repository.findById(task.id))!.assigneeId).toBeNull();
  });

  it('creates a new entry when updating a task id that was never saved', async () => {
    const task = createTestTask({
      id: 'task-update-without-save',
      title: 'Upserted via update',
    });

    await repository.update(task);

    const stored = await repository.findById(task.id);

    expect(stored).not.toBeNull();
    expect(stored!.title).toBe('Upserted via update');
  });
});
