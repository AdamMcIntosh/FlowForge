/**
 * Unit tests for createDeleteTaskUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TaskNotFoundError,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createDeleteTaskUseCase } from './delete.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createDeleteTaskUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('deletes the task when the user owns the project', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    await deleteTask({
      userId: 'user-1',
      taskId: 'task-1',
    });

    expect(await deps.taskRepository.findById('task-1')).toBeNull();
  });

  it('resolves without a return value on success', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    const result = await deleteTask({
      userId: 'user-1',
      taskId: 'task-1',
    });

    expect(result).toBeUndefined();
  });

  it('throws TaskNotFoundError when the task does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    await expect(
      deleteTask({
        userId: 'user-1',
        taskId: 'missing-task',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError when the project does not exist', async () => {
    await seedTask(deps.taskRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    await expect(
      deleteTask({
        userId: 'user-1',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError with TASK_NOT_FOUND code', async () => {
    const deleteTask = createDeleteTaskUseCase(deps);

    let error: TaskNotFoundError | undefined;

    try {
      await deleteTask({
        userId: 'user-1',
        taskId: 'missing-task',
      });
    } catch (caught) {
      error = caught as TaskNotFoundError;
    }

    expect(error?.code).toBe('TASK_NOT_FOUND');
  });

  it('throws UnauthorizedTaskAccessError when the user is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    await expect(
      deleteTask({
        userId: 'user-2',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    expect(await deps.taskRepository.findById('task-1')).not.toBeNull();
  });

  it('throws UnauthorizedTaskAccessError when the assignee is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const deleteTask = createDeleteTaskUseCase(deps);

    await expect(
      deleteTask({
        userId: 'user-2',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    expect(await deps.taskRepository.findById('task-1')).not.toBeNull();
  });

  it('propagates repository delete failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const deleteError = new Error('database unavailable');
    deps.taskRepository.delete = vi.fn().mockRejectedValue(deleteError);
    const deleteTask = createDeleteTaskUseCase(deps);

    await expect(
      deleteTask({
        userId: 'user-1',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(deleteError);

    expect(await deps.taskRepository.findById('task-1')).not.toBeNull();
  });

  it('throws UnauthorizedTaskAccessError with TASK_UNAUTHORIZED code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const deleteTask = createDeleteTaskUseCase(deps);

    let error: UnauthorizedTaskAccessError | undefined;

    try {
      await deleteTask({
        userId: 'user-2',
        taskId: 'task-1',
      });
    } catch (caught) {
      error = caught as UnauthorizedTaskAccessError;
    }

    expect(error?.code).toBe('TASK_UNAUTHORIZED');
  });
});
