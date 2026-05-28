import { ProjectNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { GetProjectInputDto, ProjectResponseDto } from './dto/index.js';
import { toProjectResponse } from './project-mapper.js';

export type GetProjectUseCaseDeps = {
  projectRepository: ProjectRepository;
};

export function createGetProjectUseCase(deps: GetProjectUseCaseDeps) {
  return async function getProject(input: GetProjectInputDto): Promise<ProjectResponseDto> {
    const project = await deps.projectRepository.findById(input.projectId);

    if (project === null) {
      throw new ProjectNotFoundError();
    }

    project.assertOwnedBy(input.userId);

    return toProjectResponse(project);
  };
}
