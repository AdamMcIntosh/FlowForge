import { randomUUID } from 'node:crypto';

import { ProjectNotFoundError, Task } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { CreateTaskInputDto, TaskResponseDto } from './dto/index.js';
import { toTaskResponse } from './task-mapper.js';

export type CreateTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createCreateTaskUseCase(deps: CreateTaskUseCaseDeps) {
  return async function createTask(input: CreateTaskInputDto): Promise<TaskResponseDto> {
    const project = await deps.projectRepository.findById(input.projectId);

    if (project === null) {
      throw new ProjectNotFoundError();
    }

    project.assertOwnedBy(input.userId);

    const task = Task.create({
      id: randomUUID(),
      title: input.title,
      projectId: input.projectId,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    });

    const savedTask = await deps.taskRepository.save(task);

    return toTaskResponse(savedTask);
  };
}
