import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { DeleteTaskInputDto } from './dto/index.js';
import { requireTaskAccessibleByProjectOwner } from './task-access.js';

export type DeleteTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createDeleteTaskUseCase(deps: DeleteTaskUseCaseDeps) {
  return async function deleteTask(input: DeleteTaskInputDto): Promise<void> {
    await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      input.taskId,
      input.userId,
    );

    await deps.taskRepository.delete(input.taskId);
  };
}
