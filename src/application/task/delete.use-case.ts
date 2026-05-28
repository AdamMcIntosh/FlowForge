import { TaskNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { DeleteTaskInputDto } from './dto/index.js';

export type DeleteTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createDeleteTaskUseCase(deps: DeleteTaskUseCaseDeps) {
  return async function deleteTask(input: DeleteTaskInputDto): Promise<void> {
    const task = await deps.taskRepository.findById(input.taskId);

    if (task === null) {
      throw new TaskNotFoundError();
    }

    const project = await deps.projectRepository.findById(task.projectId);

    if (project === null) {
      throw new TaskNotFoundError();
    }

    task.assertAccessibleByProjectOwner(project.ownerId, input.userId);

    await deps.taskRepository.delete(input.taskId);
  };
}
