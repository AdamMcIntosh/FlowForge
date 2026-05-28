import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { ListProjectsInputDto, ListProjectsResponseDto } from './dto/index.js';
import { toProjectResponse } from './project-mapper.js';

export type ListProjectsUseCaseDeps = {
  projectRepository: ProjectRepository;
};

export function createListProjectsUseCase(deps: ListProjectsUseCaseDeps) {
  return async function listProjects(
    input: ListProjectsInputDto,
  ): Promise<ListProjectsResponseDto> {
    const projects = await deps.projectRepository.findByOwnerId(input.ownerId);

    return {
      projects: projects.map(toProjectResponse),
    };
  };
}
