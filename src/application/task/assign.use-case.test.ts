/**
 * Unit tests for createAssignTaskUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Task,
  TaskNotFoundError,
  TaskStatus,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createAssignTaskUseCase } from './assign.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createAssignTaskUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('assigns an assignee and returns a mapped response DTO', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const assignTask = createAssignTaskUseCase(deps);

    const result = await assignTask({
      userId: 'user-1',
      taskId: 'task-1',
      assigneeId: 'user-2',
    });

    expect(result).toMatchObject({
      id: 'task-1',
      title: 'My Task',
      description: 'Details',
      status: TaskStatus.TODO,
      projectId: 'project-1',
      assigneeId: 'user-2',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.assigneeId).toBe('user-2');
  });

  it('returns the mapped response from the task returned by update', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const persistedTask = Task.reconstitute({
      id: 'task-1',
      title: 'My Task',
      description: 'Details',
      status: TaskStatus.IN_PROGRESS,
      projectId: 'project-1',
      assigneeId: 'user-3',
      createdAt: new Date('2025-06-01T12:00:00.000Z'),
      updatedAt: new Date('2025-06-01T12:30:00.000Z'),
    });
    deps.taskRepository.update = vi.fn(async () => persistedTask);
    const assignTask = createAssignTaskUseCase(deps);

    const result = await assignTask({
      userId: 'user-1',
      taskId: 'task-1',
      assigneeId: 'user-2',
    });

    expect(result).toEqual({
      id: 'task-1',
      title: 'My Task',
      description: 'Details',
      status: TaskStatus.IN_PROGRESS,
      projectId: 'project-1',
      assigneeId: 'user-3',
      createdAt: '2025-06-01T12:00:00.000Z',
      updatedAt: '2025-06-01T12:30:00.000Z',
    });
  });

  it('clears the assignee when assigneeId is null', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const assignTask = createAssignTaskUseCase(deps);

    const result = await assignTask({
      userId: 'user-1',
      taskId: 'task-1',
      assigneeId: null,
    });

    expect(result.assigneeId).toBeNull();

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.assigneeId).toBeNull();
  });

  it('throws TaskNotFoundError when the task does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);
    const assignTask = createAssignTaskUseCase(deps);

    await expect(
      assignTask({
        userId: 'user-1',
        taskId: 'missing-task',
        assigneeId: 'user-2',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError when the project does not exist', async () => {
    await seedTask(deps.taskRepository);
    const assignTask = createAssignTaskUseCase(deps);

    await expect(
      assignTask({
        userId: 'user-1',
        taskId: 'task-1',
        assigneeId: 'user-2',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError with TASK_NOT_FOUND code', async () => {
    const assignTask = createAssignTaskUseCase(deps);

    let error: TaskNotFoundError | undefined;

    try {
      await assignTask({
        userId: 'user-1',
        taskId: 'missing-task',
        assigneeId: 'user-2',
      });
    } catch (caught) {
      error = caught as TaskNotFoundError;
    }

    expect(error?.code).toBe('TASK_NOT_FOUND');
  });

  it('throws UnauthorizedTaskAccessError when the user is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const assignTask = createAssignTaskUseCase(deps);

    await expect(
      assignTask({
        userId: 'user-2',
        taskId: 'task-1',
        assigneeId: 'user-3',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.assigneeId).toBeNull();
  });

  it('reassigns when the task already has an assignee', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const assignTask = createAssignTaskUseCase(deps);

    const result = await assignTask({
      userId: 'user-1',
      taskId: 'task-1',
      assigneeId: 'user-3',
    });

    expect(result.assigneeId).toBe('user-3');
    expect((await deps.taskRepository.findById('task-1'))?.assigneeId).toBe('user-3');
  });

  it('propagates repository update failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateError = new Error('database unavailable');
    deps.taskRepository.update = vi.fn().mockRejectedValue(updateError);
    const assignTask = createAssignTaskUseCase(deps);

    await expect(
      assignTask({
        userId: 'user-1',
        taskId: 'task-1',
        assigneeId: 'user-2',
      }),
    ).rejects.toThrow(updateError);

    expect((await deps.taskRepository.findById('task-1'))?.assigneeId).toBeNull();
  });

  it('throws UnauthorizedTaskAccessError with TASK_UNAUTHORIZED code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const assignTask = createAssignTaskUseCase(deps);

    let error: UnauthorizedTaskAccessError | undefined;

    try {
      await assignTask({
        userId: 'user-2',
        taskId: 'task-1',
        assigneeId: 'user-3',
      });
    } catch (caught) {
      error = caught as UnauthorizedTaskAccessError;
    }

    expect(error?.code).toBe('TASK_UNAUTHORIZED');
  });
});
