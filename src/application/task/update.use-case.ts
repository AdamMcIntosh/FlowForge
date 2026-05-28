import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { TaskResponseDto, UpdateTaskInputDto } from './dto/index.js';
import { requireTaskAccessibleByProjectOwner } from './task-access.js';
import { toTaskResponse } from './task-mapper.js';

export type UpdateTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createUpdateTaskUseCase(deps: UpdateTaskUseCaseDeps) {
  return async function updateTask(input: UpdateTaskInputDto): Promise<TaskResponseDto> {
    const task = await requireTaskAccessibleByProjectOwner(
      deps.taskRepository,
      deps.projectRepository,
      input.taskId,
      input.userId,
    );

    const updatedTask = task.update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    });

    const savedTask = await deps.taskRepository.update(updatedTask);

    return toTaskResponse(savedTask);
  };
}
