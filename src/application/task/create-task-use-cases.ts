import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import { createCreateTaskUseCase } from './create.use-case.js';
import { createDeleteTaskUseCase } from './delete.use-case.js';
import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  getTaskInputSchema,
  listTasksInputSchema,
  updateTaskInputSchema,
} from './dto/index.js';
import { createGetTaskUseCase } from './get.use-case.js';
import { createListTasksUseCase } from './list.use-case.js';
import type { TaskUseCaseDependencies, TaskUseCases } from './types.js';
import { createUpdateTaskUseCase } from './update.use-case.js';

export function createTaskUseCases(deps: TaskUseCaseDependencies): TaskUseCases {
  const create = createCreateTaskUseCase(deps);
  const list = createListTasksUseCase(deps);
  const get = createGetTaskUseCase(deps);
  const update = createUpdateTaskUseCase(deps);
  const del = createDeleteTaskUseCase(deps);

  return {
    async create(input: unknown) {
      return create(createTaskInputSchema.parse(input));
    },

    async list(input: unknown) {
      return list(listTasksInputSchema.parse(input));
    },

    async get(input: unknown) {
      return get(getTaskInputSchema.parse(input));
    },

    async update(input: unknown) {
      return update(updateTaskInputSchema.parse(input));
    },

    async delete(input: unknown) {
      return del(deleteTaskInputSchema.parse(input));
    },
  };
}

export function createTaskUseCasesFromInfrastructure(
  taskRepository: TaskRepository,
  projectRepository: ProjectRepository,
): TaskUseCases {
  return createTaskUseCases({ taskRepository, projectRepository });
}
