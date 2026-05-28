import type { ProjectRepository } from '../../infrastructure/project/types.js';
import {
  createProjectInputSchema,
  deleteProjectInputSchema,
  getProjectInputSchema,
  listProjectsInputSchema,
  updateProjectInputSchema,
} from './dto/index.js';
import { createCreateProjectUseCase } from './create.use-case.js';
import { createDeleteProjectUseCase } from './delete.use-case.js';
import { createGetProjectUseCase } from './get.use-case.js';
import { createListProjectsUseCase } from './list.use-case.js';
import { createUpdateProjectUseCase } from './update.use-case.js';
import type { ProjectUseCaseDependencies, ProjectUseCases } from './types.js';

export function createProjectUseCases(deps: ProjectUseCaseDependencies): ProjectUseCases {
  const create = createCreateProjectUseCase(deps);
  const list = createListProjectsUseCase(deps);
  const get = createGetProjectUseCase(deps);
  const update = createUpdateProjectUseCase(deps);
  const del = createDeleteProjectUseCase(deps);

  return {
    async create(input: unknown) {
      return create(createProjectInputSchema.parse(input));
    },

    async list(input: unknown) {
      return list(listProjectsInputSchema.parse(input));
    },

    async get(input: unknown) {
      return get(getProjectInputSchema.parse(input));
    },

    async update(input: unknown) {
      return update(updateProjectInputSchema.parse(input));
    },

    async delete(input: unknown) {
      return del(deleteProjectInputSchema.parse(input));
    },
  };
}

export function createProjectUseCasesFromInfrastructure(
  projectRepository: ProjectRepository,
): ProjectUseCases {
  return createProjectUseCases({ projectRepository });
}
