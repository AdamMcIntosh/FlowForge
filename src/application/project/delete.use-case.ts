import { ProjectNotFoundError } from '../../domain/index.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { DeleteProjectInputDto } from './dto/index.js';

export type DeleteProjectUseCaseDeps = {
  projectRepository: ProjectRepository;
};

export function createDeleteProjectUseCase(deps: DeleteProjectUseCaseDeps) {
  return async function deleteProject(input: DeleteProjectInputDto): Promise<void> {
    const project = await deps.projectRepository.findById(input.projectId);

    if (project === null) {
      throw new ProjectNotFoundError();
    }

    project.assertOwnedBy(input.userId);

    await deps.projectRepository.delete(input.projectId);
  };
}
