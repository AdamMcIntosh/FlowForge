import { TaskNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { AssignTaskInputDto, TaskResponseDto } from './dto/index.js';
import { toTaskResponse } from './task-mapper.js';

export type AssignTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createAssignTaskUseCase(deps: AssignTaskUseCaseDeps) {
  return async function assignTask(input: AssignTaskInputDto): Promise<TaskResponseDto> {
    const task = await deps.taskRepository.findById(input.taskId);

    if (task === null) {
      throw new TaskNotFoundError();
    }

    const project = await deps.projectRepository.findById(task.projectId);

    if (project === null) {
      throw new TaskNotFoundError();
    }

    task.assertAccessibleByProjectOwner(project.ownerId, input.userId);

    const updatedTask = task.update({ assigneeId: input.assigneeId });

    const savedTask = await deps.taskRepository.update(updatedTask);

    return toTaskResponse(savedTask);
  };
}
