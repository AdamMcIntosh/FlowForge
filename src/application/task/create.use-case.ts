import { randomUUID } from 'node:crypto';

import { Task } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { CreateTaskInputDto, TaskResponseDto } from './dto/index.js';
import { requireOwnedProject } from './task-access.js';
import { toTaskResponse } from './task-mapper.js';

export type CreateTaskUseCaseDeps = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export function createCreateTaskUseCase(deps: CreateTaskUseCaseDeps) {
  return async function createTask(input: CreateTaskInputDto): Promise<TaskResponseDto> {
    await requireOwnedProject(deps.projectRepository, input.projectId, input.userId);

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
