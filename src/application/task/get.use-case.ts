import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { GetTaskInputDto, TaskResponseDto } from './dto/index.js';
import { requireTaskAccessibleByProjectOwner } from './task-access.js';
import { toTaskResponse } from './task-mapper.js';

export type GetTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createGetTaskUseCase(deps: GetTaskUseCaseDeps) {
  return async function getTask(input: GetTaskInputDto): Promise<TaskResponseDto> {
    const task = await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      input.taskId,
      input.userId,
    );

    return toTaskResponse(task);
  };
}
