/**
 * Shared fixtures for Task application-layer unit tests.
 *
 * Setup: call `createFreshTaskUseCaseDeps()` inside `beforeEach` so each test
 * gets isolated in-memory task + project repositories (no PostgreSQL).
 * Use `seedOwnedProject` / `seedTask` to populate data before invoking use cases.
 */
import { Project } from '../../src/domain/project/project.js';
import { Task, TaskStatus, type TaskStatusValue } from '../../src/domain/index.js';
import type { ProjectRepository } from '../../src/infrastructure/project/types.js';
import type { TaskRepository } from '../../src/infrastructure/task/types.js';
import { createInMemoryProjectRepository } from './in-memory-project-repository.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';

export const DEFAULT_CREATED_AT = new Date('2025-01-01T00:00:00.000Z');

export type TaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

/** Fresh in-memory repositories — call inside `beforeEach` to avoid cross-test leakage. */
export function createFreshTaskUseCaseDeps(): TaskUseCaseDeps {
  return {
    taskRepository: createInMemoryTaskRepository(),
    projectRepository: createInMemoryProjectRepository(),
  };
}

export async function seedOwnedProject(
  projectRepository: ProjectRepository,
  options?: {
    id?: string;
    ownerId?: string;
    name?: string;
  },
): Promise<Project> {
  const project = Project.create({
    id: options?.id ?? 'project-1',
    name: options?.name ?? 'Task Project',
    ownerId: options?.ownerId ?? 'user-1',
    createdAt: DEFAULT_CREATED_AT,
  });
  return projectRepository.save(project);
}

export type SeedTaskOptions = {
  id?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatusValue;
  projectId?: string;
  assigneeId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export async function seedTask(
  taskRepository: TaskRepository,
  options?: SeedTaskOptions,
): Promise<Task> {
  const task = Task.reconstitute({
    id: options?.id ?? 'task-1',
    title: options?.title ?? 'My Task',
    description: options?.description ?? 'Details',
    status: options?.status ?? TaskStatus.TODO,
    projectId: options?.projectId ?? 'project-1',
    assigneeId: options?.assigneeId ?? null,
    createdAt: options?.createdAt ?? DEFAULT_CREATED_AT,
    updatedAt: options?.updatedAt ?? DEFAULT_CREATED_AT,
  });
  return taskRepository.save(task);
}
