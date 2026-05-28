import { ProjectNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { ListTasksInputDto, ListTasksResponseDto } from './dto/index.js';
import { toTaskResponse } from './task-mapper.js';

export type ListTasksUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createListTasksUseCase(deps: ListTasksUseCaseDeps) {
  return async function listTasks(input: ListTasksInputDto): Promise<ListTasksResponseDto> {
    const project = await deps.projectRepository.findById(input.projectId);

    if (project === null) {
      throw new ProjectNotFoundError();
    }

    project.assertOwnedBy(input.userId);

    const tasks = await deps.taskRepository.findByProjectId(input.projectId);

    return {
      tasks: tasks.map(toTaskResponse),
    };
  };
}
