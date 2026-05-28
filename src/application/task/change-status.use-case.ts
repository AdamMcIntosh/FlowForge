import { TaskNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { ChangeTaskStatusInputDto, TaskResponseDto } from './dto/index.js';
import { toTaskResponse } from './task-mapper.js';

export type ChangeTaskStatusUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createChangeTaskStatusUseCase(deps: ChangeTaskStatusUseCaseDeps) {
  return async function changeTaskStatus(
    input: ChangeTaskStatusInputDto,
  ): Promise<TaskResponseDto> {
    const task = await deps.taskRepository.findById(input.taskId);

    if (task === null) {
      throw new TaskNotFoundError();
    }

    const project = await deps.projectRepository.findById(task.projectId);

    if (project === null) {
      throw new TaskNotFoundError();
    }

    task.assertAccessibleByProjectOwner(project.ownerId, input.userId);

    const updatedTask = task.update({ status: input.status });

    const savedTask = await deps.taskRepository.update(updatedTask);

    return toTaskResponse(savedTask);
  };
}
