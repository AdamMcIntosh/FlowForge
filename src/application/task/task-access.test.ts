/**
 * Unit tests for task-access authorization helpers.
 *
 * Setup: fresh in-memory repositories per test via createFreshTaskUseCaseDeps()
 * (see tests/helpers/task-use-case-fixtures.ts). No PostgreSQL required.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ProjectNotFoundError,
  ProjectOwnershipError,
  TaskNotFoundError,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';
import {
  requireOwnedProject,
  requireTaskAccessibleByProjectOwner,
} from './task-access.js';
import {
  createFreshTaskUseCaseDeps,
  seedOwnedProject,
  seedTask,
  type TaskUseCaseDeps,
} from '../../../tests/helpers/task-use-case-fixtures.js';

describe('requireOwnedProject', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('returns the project when the caller owns it', async () => {
    const seeded = await seedOwnedProject(deps.projectRepository, {
      id: 'project-1',
      ownerId: 'user-1',
      name: 'Owned Project',
    });

    const project = await requireOwnedProject(
      deps.projectRepository,
      'project-1',
      'user-1',
    );

    expect(project).toBe(seeded);
    expect(project.id).toBe('project-1');
    expect(project.ownerId).toBe('user-1');
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    await expect(
      requireOwnedProject(deps.projectRepository, 'missing-project', 'user-1'),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it('throws ProjectOwnershipError when the caller does not own the project', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });

    await expect(
      requireOwnedProject(deps.projectRepository, 'project-1', 'user-2'),
    ).rejects.toThrow(ProjectOwnershipError);
  });
});

describe('requireTaskAccessibleByProjectOwner', () => {
  let deps: TaskUseCaseDeps;

  beforeEach(() => {
    deps = createFreshTaskUseCaseDeps();
  });

  it('returns the task when the caller owns the parent project', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    const seeded = await seedTask(deps.taskRepository, {
      id: 'task-1',
      title: 'Accessible Task',
    });

    const task = await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      'task-1',
      'user-1',
    );

    expect(task).toBe(seeded);
    expect(task.id).toBe('task-1');
    expect(task.projectId).toBe('project-1');
  });

  it('throws TaskNotFoundError when the task is missing or its parent project does not exist', async () => {
    await seedOwnedProject(deps.projectRepository);

    await expect(
      requireTaskAccessibleByProjectOwner(
        deps.taskRepository,
        deps.projectRepository,
        'missing-task',
        'user-1',
      ),
    ).rejects.toThrow(TaskNotFoundError);

    await seedTask(deps.taskRepository, { projectId: 'deleted-project' });

    await expect(
      requireTaskAccessibleByProjectOwner(
        deps.taskRepository,
        deps.projectRepository,
        'task-1',
        'user-1',
      ),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('throws UnauthorizedTaskAccessError when the caller is not the project owner', async () => {
    await seedOwnedProject(deps.projectRepository, { ownerId: 'user-1' });
    await seedTask(deps.taskRepository, { assigneeId: 'user-2' });

    await expect(
      requireTaskAccessibleByProjectOwner(
        deps.taskRepository,
        deps.projectRepository,
        'task-1',
        'user-2',
      ),
    ).rejects.toThrow(UnauthorizedTaskAccessError);
  });
});
