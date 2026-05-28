import type { ProjectId } from '../../domain/project/project.js';
import type { Task, TaskId } from '../../domain/task/task.js';
import type { TaskRepository } from './types.js';

/**
 * In-memory TaskRepository for tests and local development.
 *
 * Authorization is enforced by callers (application use cases) via domain
 * helpers on returned Task entities — not inside this repository.
 * `findByProjectId` is the project-scoped listing boundary; `findById` returns
 * tasks from any project so callers must verify project ownership.
 */
export function createInMemoryTaskRepository(): TaskRepository {
  const tasksById = new Map<TaskId, Task>();

  return {
    async save(task: Task): Promise<Task> {
      tasksById.set(task.id, task);
      return task;
    },

    async findById(id: TaskId): Promise<Task | null> {
      return tasksById.get(id) ?? null;
    },

    async findByProjectId(projectId: ProjectId): Promise<Task[]> {
      return [...tasksById.values()]
        .filter((task) => task.isInProject(projectId))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async update(task: Task): Promise<Task> {
      tasksById.set(task.id, task);
      return task;
    },

    async delete(id: TaskId): Promise<void> {
      tasksById.delete(id);
    },
  };
}
