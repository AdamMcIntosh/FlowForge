/**
 * Unit tests for createGetTaskUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TaskNotFoundError,
  TaskStatus,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createGetTaskUseCase } from './get.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createGetTaskUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('returns assigneeId and status from the persisted task', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      status: TaskStatus.IN_PROGRESS,
      assigneeId: 'user-2',
    });
    const getTask = createGetTaskUseCase(deps);

    const result = await getTask({
      userId: 'user-1',
      taskId: 'task-1',
    });

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.assigneeId).toBe('user-2');
  });

  it('returns a mapped task when the user owns the project', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      title: 'My Task',
      description: 'Details',
    });
    const getTask = createGetTaskUseCase(deps);

    const result = await getTask({
      userId: 'user-1',
      taskId: 'task-1',
    });

    expect(result).toEqual({
      id: 'task-1',
      title: 'My Task',
      description: 'Details',
      status: TaskStatus.TODO,
      projectId: 'project-1',
      assigneeId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('throws TaskNotFoundError when the task does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);
    const getTask = createGetTaskUseCase(deps);

    await expect(
      getTask({
        userId: 'user-1',
        taskId: 'missing-task',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError when the project does not exist', async () => {
    await seedTask(deps.taskRepository);
    const getTask = createGetTaskUseCase(deps);

    await expect(
      getTask({
        userId: 'user-1',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws UnauthorizedTaskAccessError when the user is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const getTask = createGetTaskUseCase(deps);

    await expect(
      getTask({
        userId: 'user-2',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);
  });

  it('throws UnauthorizedTaskAccessError when the assignee is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const getTask = createGetTaskUseCase(deps);

    await expect(
      getTask({
        userId: 'user-2',
        taskId: 'task-1',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);
  });

  it('allows the project owner to read a task assigned to another user', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, {
      title: 'Delegated work',
      assigneeId: 'user-2',
      status: TaskStatus.IN_PROGRESS,
    });
    const getTask = createGetTaskUseCase(deps);

    const result = await getTask({
      userId: 'user-1',
      taskId: 'task-1',
    });

    expect(result.title).toBe('Delegated work');
    expect(result.assigneeId).toBe('user-2');
    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
  });

  it('throws TaskNotFoundError with TASK_NOT_FOUND code', async () => {
    const getTask = createGetTaskUseCase(deps);

    let error: TaskNotFoundError | undefined;

    try {
      await getTask({
        userId: 'user-1',
        taskId: 'missing-task',
      });
    } catch (caught) {
      error = caught as TaskNotFoundError;
    }

    expect(error?.code).toBe('TASK_NOT_FOUND');
  });

  it('throws UnauthorizedTaskAccessError with TASK_UNAUTHORIZED code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const getTask = createGetTaskUseCase(deps);

    let error: UnauthorizedTaskAccessError | undefined;

    try {
      await getTask({
        userId: 'user-2',
        taskId: 'task-1',
      });
    } catch (caught) {
      error = caught as UnauthorizedTaskAccessError;
    }

    expect(error?.code).toBe('TASK_UNAUTHORIZED');
  });
});
