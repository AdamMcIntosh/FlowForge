/**
 * Unit tests for createChangeTaskStatusUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TaskNotFoundError,
  TaskStatus,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createChangeTaskStatusUseCase } from './change-status.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createChangeTaskStatusUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('changes status to IN_PROGRESS and returns a mapped response DTO', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { description: null });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    const result = await changeTaskStatus({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
    });

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.id).toBe('task-1');

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.status).toBe(TaskStatus.IN_PROGRESS);
  });

  it('changes status back to TODO', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      description: null,
      status: TaskStatus.DONE,
    });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    const result = await changeTaskStatus({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.TODO,
    });

    expect(result.status).toBe(TaskStatus.TODO);
    expect((await deps.taskRepository.findById('task-1'))?.status).toBe(TaskStatus.TODO);
  });

  it('changes status to DONE', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      description: null,
      status: TaskStatus.IN_PROGRESS,
    });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    const result = await changeTaskStatus({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.DONE,
    });

    expect(result.status).toBe(TaskStatus.DONE);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.status).toBe(TaskStatus.DONE);
  });

  it('preserves title, description, assignee, and projectId when only status changes', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      title: 'Scoped task',
      description: 'Keep me',
      assigneeId: 'user-2',
      status: TaskStatus.TODO,
    });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    const result = await changeTaskStatus({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
    });

    expect(result).toMatchObject({
      title: 'Scoped task',
      description: 'Keep me',
      assigneeId: 'user-2',
      projectId: 'project-1',
      status: TaskStatus.IN_PROGRESS,
    });
  });

  it('maps repository timestamps to ISO strings via toTaskResponse', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { description: null });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    const result = await changeTaskStatus({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
    });

    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.updatedAt).not.toBe(result.createdAt);
  });

  it('throws TaskNotFoundError when the task does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    await expect(
      changeTaskStatus({
        userId: 'user-1',
        taskId: 'missing-task',
        status: TaskStatus.DONE,
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError when the project does not exist', async () => {
    await seedTask(deps.taskRepository, { description: null });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    await expect(
      changeTaskStatus({
        userId: 'user-1',
        taskId: 'task-1',
        status: TaskStatus.DONE,
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError with TASK_NOT_FOUND code', async () => {
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    let error: TaskNotFoundError | undefined;

    try {
      await changeTaskStatus({
        userId: 'user-1',
        taskId: 'missing-task',
        status: TaskStatus.DONE,
      });
    } catch (caught) {
      error = caught as TaskNotFoundError;
    }

    expect(error?.code).toBe('TASK_NOT_FOUND');
  });

  it('throws UnauthorizedTaskAccessError when the user is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { description: null });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    await expect(
      changeTaskStatus({
        userId: 'user-2',
        taskId: 'task-1',
        status: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.status).toBe(TaskStatus.TODO);
  });

  it('propagates repository update failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { description: null });
    const updateError = new Error('database unavailable');
    deps.taskRepository.update = vi.fn().mockRejectedValue(updateError);
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    await expect(
      changeTaskStatus({
        userId: 'user-1',
        taskId: 'task-1',
        status: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow(updateError);

    expect((await deps.taskRepository.findById('task-1'))?.status).toBe(TaskStatus.TODO);
  });

  it('throws UnauthorizedTaskAccessError with TASK_UNAUTHORIZED code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { description: null });
    const changeTaskStatus = createChangeTaskStatusUseCase(deps);

    let error: UnauthorizedTaskAccessError | undefined;

    try {
      await changeTaskStatus({
        userId: 'user-2',
        taskId: 'task-1',
        status: TaskStatus.IN_PROGRESS,
      });
    } catch (caught) {
      error = caught as UnauthorizedTaskAccessError;
    }

    expect(error?.code).toBe('TASK_UNAUTHORIZED');
  });
});
