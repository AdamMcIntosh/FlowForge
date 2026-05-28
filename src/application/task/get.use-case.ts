import { TaskNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { GetTaskInputDto, TaskResponseDto } from './dto/index.js';
import { toTaskResponse } from './task-mapper.js';

export type GetTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createGetTaskUseCase(deps: GetTaskUseCaseDeps) {
  return async function getTask(input: GetTaskInputDto): Promise<TaskResponseDto> {
    const task = await deps.taskRepository.findById(input.taskId);

    if (task === null) {
      throw new TaskNotFoundError();
    }

    const project = await deps.projectRepository.findById(task.projectId);

    if (project === null) {
      throw new TaskNotFoundError();
    }

    task.assertAccessibleByProjectOwner(project.ownerId, input.userId);

    return toTaskResponse(task);
  };
}
