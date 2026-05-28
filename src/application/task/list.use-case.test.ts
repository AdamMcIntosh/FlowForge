/**
 * Unit tests for createListTasksUseCase.
 * Uses fresh in-memory repositories per test (see tests/helpers/task-use-case-fixtures.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProjectNotFoundError,
  ProjectOwnershipError,
  TaskStatus,
} from '../../domain/index.js';
import { createListTasksUseCase } from './list.use-case.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('createListTasksUseCase', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('returns mapped tasks for an owned project', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, { id: 'task-1', title: 'Alpha', description: null });
    await seedTask(deps.taskRepository, { id: 'task-2', title: 'Beta', description: null });
    const listTasks = createListTasksUseCase(deps);

    const result = await listTasks({
      userId: 'user-1',
      projectId: 'project-1',
    });

    expect(result.tasks).toHaveLength(2);
    const titles = result.tasks.map((task) => task.title).sort();
    expect(titles).toEqual(['Alpha', 'Beta']);
    expect(result.tasks[0]).toMatchObject({
      status: TaskStatus.TODO,
      projectId: 'project-1',
      assigneeId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
  });

  it('orders tasks by updatedAt descending (newest first)', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      id: 'task-old',
      title: 'Older',
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    await seedTask(deps.taskRepository, {
      id: 'task-new',
      title: 'Newer',
      updatedAt: new Date('2025-06-15T12:00:00.000Z'),
    });
    const listTasks = createListTasksUseCase(deps);

    const result = await listTasks({
      userId: 'user-1',
      projectId: 'project-1',
    });

    expect(result.tasks.map((task) => task.id)).toEqual(['task-new', 'task-old']);
  });

  it('returns an empty list when the project has no tasks', async () => {
    await seedOwnedProject(deps.projectRepository);
    const listTasks = createListTasksUseCase(deps);

    const result = await listTasks({
      userId: 'user-1',
      projectId: 'project-1',
    });

    expect(result.tasks).toEqual([]);
  });

  it('maps tasks with assignees and non-default statuses', async () => {
    await seedOwnedProject(deps.projectRepository);
    await seedTask(deps.taskRepository, {
      id: 'task-done',
      title: 'Finished',
      description: null,
      status: TaskStatus.DONE,
      assigneeId: 'user-2',
    });
    const listTasks = createListTasksUseCase(deps);

    const result = await listTasks({
      userId: 'user-1',
      projectId: 'project-1',
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'task-done',
      title: 'Finished',
      status: TaskStatus.DONE,
      assigneeId: 'user-2',
      projectId: 'project-1',
    });
  });

  it('does not return tasks from other projects', async () => {
    await seedOwnedProject(deps.projectRepository, { id: 'project-1' });
    await seedOwnedProject(deps.projectRepository, {
      id: 'project-2',
      ownerId: 'user-1',
      name: 'Other',
    });
    await seedTask(deps.taskRepository, { id: 'task-1', projectId: 'project-1', title: 'In scope' });
    await seedTask(deps.taskRepository, {
      id: 'task-2',
      projectId: 'project-2',
      title: 'Out of scope',
    });
    const listTasks = createListTasksUseCase(deps);

    const result = await listTasks({
      userId: 'user-1',
      projectId: 'project-1',
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.title).toBe('In scope');
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    const listTasks = createListTasksUseCase(deps);

    await expect(
      listTasks({
        userId: 'user-1',
        projectId: 'missing-project',
      }),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it('throws ProjectOwnershipError when the user does not own the project', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    const listTasks = createListTasksUseCase(deps);

    await expect(
      listTasks({
        userId: 'user-2',
        projectId: 'project-1',
      }),
    ).rejects.toThrow(ProjectOwnershipError);
  });

  it('throws ProjectNotFoundError with PROJECT_NOT_FOUND code', async () => {
    const listTasks = createListTasksUseCase(deps);

    let error: ProjectNotFoundError | undefined;

    try {
      await listTasks({
        userId: 'user-1',
        projectId: 'missing-project',
      });
    } catch (caught) {
      error = caught as ProjectNotFoundError;
    }

    expect(error?.code).toBe('PROJECT_NOT_FOUND');
  });

  it('throws ProjectOwnershipError with PROJECT_OWNERSHIP code', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    const listTasks = createListTasksUseCase(deps);

    let error: ProjectOwnershipError | undefined;

    try {
      await listTasks({
        userId: 'user-2',
        projectId: 'project-1',
      });
    } catch (caught) {
      error = caught as ProjectOwnershipError;
    }

    expect(error?.code).toBe('PROJECT_OWNERSHIP');
  });

  it('propagates repository findByProjectId failures', async () => {
    await seedOwnedProject(deps.projectRepository);
    const listError = new Error('database unavailable');
    deps.taskRepository.findByProjectId = vi.fn().mockRejectedValue(listError);
    const listTasks = createListTasksUseCase(deps);

    await expect(
      listTasks({
        userId: 'user-1',
        projectId: 'project-1',
      }),
    ).rejects.toThrow(listError);
  });
});
