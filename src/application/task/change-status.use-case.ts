import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { ChangeTaskStatusInputDto, TaskResponseDto } from './dto/index.js';
import { requireTaskAccessibleByProjectOwner } from './task-access.js';
import { toTaskResponse } from './task-mapper.js';

export type ChangeTaskStatusUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createChangeTaskStatusUseCase(deps: ChangeTaskStatusUseCaseDeps) {
  return async function changeTaskStatus(
    input: ChangeTaskStatusInputDto,
  ): Promise<TaskResponseDto> {
    const task = await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      input.taskId,
      input.userId,
    );

    const updatedTask = task.update({ status: input.status });

    const savedTask = await deps.taskRepository.update(updatedTask);

    return toTaskResponse(savedTask);
  };
}
