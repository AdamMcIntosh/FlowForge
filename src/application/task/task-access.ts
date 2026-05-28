import type { UserId } from '../../domain/auth/user.js';
import { ProjectNotFoundError, TaskNotFoundError } from '../../domain/index.js';
import type { Project } from '../../domain/project/project.js';
import type { ProjectId } from '../../domain/project/project.js';
import type { Task, TaskId } from '../../domain/task/task.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';

/**
 * Resolves a project via the repository and enforces that the caller owns it.
 * Used by create/list (project-scoped) operations.
 */
export async function requireOwnedProject(
  projectRepository: ProjectRepository,
  projectId: ProjectId,
  userId: UserId,
): Promise<Project> {
  const project = await projectRepository.findById(projectId);

  if (project === null) {
    throw new ProjectNotFoundError();
  }

  project.assertOwnedBy(userId);

  return project;
}

/**
 * Loads a task and its parent project via repositories, then enforces project-owner access.
 * Used by get/update/delete/assign/changeStatus (task-id-scoped) operations.
 */
export async function requireTaskAccessibleByProjectOwner(
  taskRepository: TaskRepository,
  projectRepository: ProjectRepository,
  taskId: TaskId,
  userId: UserId,
): Promise<Task> {
  const task = await taskRepository.findById(taskId);

  if (task === null) {
    throw new TaskNotFoundError();
  }

  const project = await projectRepository.findById(task.projectId);

  if (project === null) {
    throw new TaskNotFoundError();
  }

  task.assertAccessibleByProjectOwner(project.ownerId, userId);

  return task;
}
