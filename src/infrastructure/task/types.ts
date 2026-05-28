import type { ProjectId } from '../../domain/project/project.js';
import type { Task, TaskId } from '../../domain/task/task.js';

export interface TaskRepository {
  save(task: Task): Promise<Task>;
  findById(id: TaskId): Promise<Task | null>;
  findByProjectId(projectId: ProjectId): Promise<Task[]>;
  update(task: Task): Promise<Task>;
  delete(id: TaskId): Promise<void>;
}
