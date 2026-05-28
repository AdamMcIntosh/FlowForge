/**
 * Unit tests for createUpdateTaskUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskDescriptionError,
  InvalidTaskTitleError,
  Task,
  TaskNotFoundError,
  TaskStatus,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import { createUpdateTaskUseCase } from './update.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createUpdateTaskUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('updates title and description and returns a mapped response DTO', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title: '  Updated Title  ',
      description: '  Updated Details  ',
    });

    expect(result.title).toBe('Updated Title');
    expect(result.description).toBe('Updated Details');

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.title).toBe('Updated Title');
  });

  it('updates only the title when other fields are omitted', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title: 'Renamed Task',
    });

    expect(result.title).toBe('Renamed Task');
    expect(result.description).toBe('Details');
  });

  it('updates only the description when title is omitted', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      description: 'New description only',
    });

    expect(result.title).toBe('My Task');
    expect(result.description).toBe('New description only');
    expect((await deps.taskRepository.findById('task-1'))?.title).toBe('My Task');
  });

  it('updates status and assigneeId', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: 'user-2',
    });

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.assigneeId).toBe('user-2');
  });

  it('clears description when null is provided', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it('clears assignee when assigneeId is null', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      assigneeId: null,
    });

    expect(result.assigneeId).toBeNull();
  });

  it('normalizes blank description to null', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      description: '   ',
    });

    expect(result.description).toBeNull();
  });

  it('throws TaskNotFoundError when the task does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'missing-task',
        title: 'Updated',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError with TASK_NOT_FOUND code', async () => {
    await seedOwnedProject(deps.projectRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    let error: TaskNotFoundError | undefined;

    try {
      await updateTask({
        userId: 'user-1',
        taskId: 'missing-task',
        title: 'Updated',
      });
    } catch (caught) {
      error = caught as TaskNotFoundError;
    }

    expect(error?.code).toBe('TASK_NOT_FOUND');
  });

  it('accepts a title at the maximum allowed length', async () => {
    const title = 'a'.repeat(255);
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title,
    });

    expect(result.title).toBe(title);
    expect((await deps.taskRepository.findById('task-1'))?.title).toBe(title);
  });

  it('returns the mapped response from the task returned by update', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const persistedTask = Task.reconstitute({
      id: 'task-1',
      title: 'Repository Title',
      description: 'Repository details',
      status: TaskStatus.DONE,
      projectId: 'project-1',
      assigneeId: 'user-2',
      createdAt: new Date('2025-06-01T12:00:00.000Z'),
      updatedAt: new Date('2025-06-01T12:30:00.000Z'),
    });
    deps.taskRepository.update = vi.fn(async () => persistedTask);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title: 'Ignored by mock',
    });

    expect(result).toEqual({
      id: 'task-1',
      title: 'Repository Title',
      description: 'Repository details',
      status: TaskStatus.DONE,
      projectId: 'project-1',
      assigneeId: 'user-2',
      createdAt: '2025-06-01T12:00:00.000Z',
      updatedAt: '2025-06-01T12:30:00.000Z',
    });
  });

  it('maps repository timestamps to ISO strings via toTaskResponse', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title: 'Updated',
    });

    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.updatedAt).not.toBe(result.createdAt);
  });

  it('preserves projectId when updating fields', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    const result = await updateTask({
      userId: 'user-1',
      taskId: 'task-1',
      title: 'Renamed',
    });

    expect(result.projectId).toBe('project-1');
    expect((await deps.taskRepository.findById('task-1'))?.projectId).toBe('project-1');
  });

  it('throws TaskNotFoundError when the project does not exist', async () => {
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        title: 'Updated',
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws UnauthorizedTaskAccessError when the user is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-2',
        taskId: 'task-1',
        title: 'Updated',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.title).toBe('My Task');
  });

  it('throws UnauthorizedTaskAccessError when the assignee is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-2',
        taskId: 'task-1',
        title: 'Updated',
      }),
    ).rejects.toThrow(UnauthorizedTaskAccessError);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.title).toBe('My Task');
  });

  it('throws InvalidTaskTitleError when domain title validation fails', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        title: '   ',
      }),
    ).rejects.toThrow(InvalidTaskTitleError);
  });

  it('throws InvalidTaskTitleError when title exceeds max length', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        title: 'a'.repeat(256),
      }),
    ).rejects.toThrow(InvalidTaskTitleError);

    expect((await deps.taskRepository.findById('task-1'))?.title).toBe('My Task');
  });

  it('throws InvalidTaskDescriptionError when description exceeds max length', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        description: 'a'.repeat(2001),
      }),
    ).rejects.toThrow(InvalidTaskDescriptionError);
  });

  it('throws InvalidTaskTitleError with TASK_INVALID_TITLE code', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    let error: InvalidTaskTitleError | undefined;

    try {
      await updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        title: '   ',
      });
    } catch (caught) {
      error = caught as InvalidTaskTitleError;
    }

    expect(error?.code).toBe('TASK_INVALID_TITLE');
  });

  it('throws InvalidTaskDescriptionError with TASK_INVALID_DESCRIPTION code', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    let error: InvalidTaskDescriptionError | undefined;

    try {
      await updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        description: 'a'.repeat(2001),
      });
    } catch (caught) {
      error = caught as InvalidTaskDescriptionError;
    }

    expect(error?.code).toBe('TASK_INVALID_DESCRIPTION');
  });

  it('throws UnauthorizedTaskAccessError with TASK_UNAUTHORIZED code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository);
    const updateTask = createUpdateTaskUseCase(deps);

    let error: UnauthorizedTaskAccessError | undefined;

    try {
      await updateTask({
        userId: 'user-2',
        taskId: 'task-1',
        title: 'Updated',
      });
    } catch (caught) {
      error = caught as UnauthorizedTaskAccessError;
    }

    expect(error?.code).toBe('TASK_UNAUTHORIZED');
  });

  it('propagates repository update failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository);
    const updateError = new Error('database unavailable');
    deps.taskRepository.update = vi.fn().mockRejectedValue(updateError);
    const updateTask = createUpdateTaskUseCase(deps);

    await expect(
      updateTask({
        userId: 'user-1',
        taskId: 'task-1',
        title: 'Updated',
      }),
    ).rejects.toThrow(updateError);

    const persisted = await deps.taskRepository.findById('task-1');
    expect(persisted?.title).toBe('My Task');
  });
});
