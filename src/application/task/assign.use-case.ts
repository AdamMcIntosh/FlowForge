import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { AssignTaskInputDto, TaskResponseDto } from './dto/index.js';
import { requireTaskAccessibleByProjectOwner } from './task-access.js';
import { toTaskResponse } from './task-mapper.js';

export type AssignTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createAssignTaskUseCase(deps: AssignTaskUseCaseDeps) {
  return async function assignTask(input: AssignTaskInputDto): Promise<TaskResponseDto> {
    const task = await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      input.taskId,
      input.userId,
    );

    const updatedTask = task.update({ assigneeId: input.assigneeId });

    const savedTask = await deps.taskRepository.update(updatedTask);

    return toTaskResponse(savedTask);
  };
}
