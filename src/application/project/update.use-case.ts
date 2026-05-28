import { ProjectNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { ProjectResponseDto, UpdateProjectInputDto } from './dto/index.js';
import { toProjectResponse } from './project-mapper.js';

export type UpdateProjectUseCaseDeps = {
  projectRepository: ProjectRepository;
};

export function createUpdateProjectUseCase(deps: UpdateProjectUseCaseDeps) {
  return async function updateProject(input: UpdateProjectInputDto): Promise<ProjectResponseDto> {
    const project = await deps.projectRepository.findById(input.projectId);

    if (project === null) {
      throw new ProjectNotFoundError();
    }

    project.assertOwnedBy(input.userId);

    const updatedProject = project.update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });

    const savedProject = await deps.projectRepository.update(updatedProject);

    return toProjectResponse(savedProject);
  };
}
