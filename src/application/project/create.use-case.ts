import { randomUUID } from 'node:crypto';

import { Project } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { CreateProjectInputDto, ProjectResponseDto } from './dto/index.js';
import { toProjectResponse } from './project-mapper.js';

export type CreateProjectUseCaseDeps = {
  projectRepository: ProjectRepository;
};

export function createCreateProjectUseCase(deps: CreateProjectUseCaseDeps) {
  return async function createProject(input: CreateProjectInputDto): Promise<ProjectResponseDto> {
    const project = Project.create({
      id: randomUUID(),
      name: input.name,
      ownerId: input.ownerId,
      ...(input.description !== undefined ? { description: input.description } : {}),
    });

    const savedProject = await deps.projectRepository.save(project);

    return toProjectResponse(savedProject);
  };
}
