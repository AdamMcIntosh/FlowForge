/**
 * Unit tests for createCreateTaskUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskDescriptionError,
  InvalidTaskTitleError,
  ProjectNotFoundError,
  ProjectOwnershipError,
  Task,
  TaskStatus,
} from '../../domain/index.js';
import { createCreateTaskUseCase } from './create.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createCreateTaskUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('creates a task in an owned project and returns a mapped response DTO', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: '  New Task  ',
      description: '  Details  ',
    });

    expect(result).toEqual({
      id: expect.any(String),
      title: 'New Task',
      description: 'Details',
      status: TaskStatus.TODO,
      projectId: 'project-1',
      assigneeId: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const persisted = await deps.taskRepository.findById(result.id);
    expect(persisted).toBeInstanceOf(Task);
    expect(persisted?.title).toBe('New Task');
    expect(persisted?.description).toBe('Details');
    expect(persisted?.projectId).toBe('project-1');
    expect(persisted?.status).toBe(TaskStatus.TODO);
  });

  it('assigns a unique id to each created task', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const first = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'First Task',
    });
    const second = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Second Task',
    });

    expect(first.id).not.toBe(second.id);
  });

  it('accepts optional status and assigneeId', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Assigned Task',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: 'user-2',
    });

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.assigneeId).toBe('user-2');

    const persisted = await deps.taskRepository.findById(result.id);
    expect(persisted?.status).toBe(TaskStatus.IN_PROGRESS);
    expect(persisted?.assigneeId).toBe('user-2');
  });

  it('defaults description to null when omitted', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Minimal Task',
    });

    expect(result.description).toBeNull();
  });

  it('normalizes blank description to null', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Task',
      description: '   ',
    });

    expect(result.description).toBeNull();
  });

  it('accepts explicit null description and assigneeId', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Explicit Nulls',
      description: null,
      assigneeId: null,
    });

    expect(result.description).toBeNull();
    expect(result.assigneeId).toBeNull();
  });

  it('accepts a title at the maximum allowed length', async () => {
    const title = 'a'.repeat(255);
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title,
    });

    expect(result.title).toBe(title);
    expect(await deps.taskRepository.findById(result.id)).not.toBeNull();
  });

  it('returns ISO datetime strings for timestamps', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Timestamped Task',
    });

    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.createdAt).toBe(result.updatedAt);
  });

  it('returns the mapped response from the task returned by save', async () => {
    await seedOwnedProject(deps.projectRepository);
    const persistedTask = Task.reconstitute({
      id: 'persisted-task-id',
      title: 'Persisted Task',
      description: 'Stored details',
      status: TaskStatus.DONE,
      projectId: 'project-1',
      assigneeId: 'user-2',
      createdAt: new Date('2025-06-01T12:00:00.000Z'),
      updatedAt: new Date('2025-06-01T12:30:00.000Z'),
    });
    deps.taskRepository.save = vi.fn(async () => persistedTask);
    const createTask = createCreateTaskUseCase(deps);

    const result = await createTask({
      userId: 'user-1',
      projectId: 'project-1',
      title: 'Persisted Task',
    });

    expect(result).toEqual({
      id: 'persisted-task-id',
      title: 'Persisted Task',
      description: 'Stored details',
      status: TaskStatus.DONE,
      projectId: 'project-1',
      assigneeId: 'user-2',
      createdAt: '2025-06-01T12:00:00.000Z',
      updatedAt: '2025-06-01T12:30:00.000Z',
    });
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-1',
        projectId: 'missing-project',
        title: 'New Task',
      }),
    ).rejects.toThrow(ProjectNotFoundError);

    const tasks = await deps.taskRepository.findByProjectId('missing-project');
    expect(tasks).toHaveLength(0);
  });

  it('throws ProjectNotFoundError with PROJECT_NOT_FOUND code', async () => {
    const createTask = createCreateTaskUseCase(deps);

    let error: ProjectNotFoundError | undefined;

    try {
      await createTask({
        userId: 'user-1',
        projectId: 'missing-project',
        title: 'New Task',
      });
    } catch (caught) {
      error = caught as ProjectNotFoundError;
    }

    expect(error?.code).toBe('PROJECT_NOT_FOUND');
  });

  it('throws ProjectOwnershipError when the user does not own the project', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-2',
        projectId: 'project-1',
        title: 'New Task',
      }),
    ).rejects.toThrow(ProjectOwnershipError);

    expect(await deps.taskRepository.findByProjectId('project-1')).toHaveLength(0);
  });

  it('throws ProjectOwnershipError with PROJECT_OWNERSHIP code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    const createTask = createCreateTaskUseCase(deps);

    let error: ProjectOwnershipError | undefined;

    try {
      await createTask({
        userId: 'user-2',
        projectId: 'project-1',
        title: 'New Task',
      });
    } catch (caught) {
      error = caught as ProjectOwnershipError;
    }

    expect(error?.code).toBe('PROJECT_OWNERSHIP');
  });

  it('throws InvalidTaskTitleError when domain title validation fails', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: '   ',
      }),
    ).rejects.toThrow(InvalidTaskTitleError);
  });

  it('throws InvalidTaskTitleError when title exceeds max length', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: 'a'.repeat(256),
      }),
    ).rejects.toThrow(InvalidTaskTitleError);
  });

  it('throws InvalidTaskTitleError with TASK_INVALID_TITLE code', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    let error: InvalidTaskTitleError | undefined;

    try {
      await createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: '   ',
      });
    } catch (caught) {
      error = caught as InvalidTaskTitleError;
    }

    expect(error?.code).toBe('TASK_INVALID_TITLE');
  });

  it('throws InvalidTaskDescriptionError when description exceeds max length', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: 'Valid Title',
        description: 'a'.repeat(2001),
      }),
    ).rejects.toThrow(InvalidTaskDescriptionError);
  });

  it('throws InvalidTaskDescriptionError with TASK_INVALID_DESCRIPTION code', async () => {
    await seedOwnedProject(deps.projectRepository);
    const createTask = createCreateTaskUseCase(deps);

    let error: InvalidTaskDescriptionError | undefined;

    try {
      await createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: 'Valid Title',
        description: 'a'.repeat(2001),
      });
    } catch (caught) {
      error = caught as InvalidTaskDescriptionError;
    }

    expect(error?.code).toBe('TASK_INVALID_DESCRIPTION');
  });

  it('propagates repository save failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    const saveError = new Error('database unavailable');
    deps.taskRepository.save = vi.fn().mockRejectedValue(saveError);
    const createTask = createCreateTaskUseCase(deps);

    await expect(
      createTask({
        userId: 'user-1',
        projectId: 'project-1',
        title: 'New Task',
      }),
    ).rejects.toThrow(saveError);
  });
});
