import type { ProjectId } from '../../src/domain/project/project.js';
import type { Task, TaskId } from '../../src/domain/task/task.js';
import type { TaskRepository } from '../../src/infrastructure/task/types.js';

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
        .filter((task) => task.projectId === projectId)
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
