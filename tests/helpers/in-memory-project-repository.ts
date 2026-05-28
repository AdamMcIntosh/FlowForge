import type { Project, ProjectId } from '../../src/domain/index.js';
import type { UserId } from '../../src/domain/auth/user.js';
import type { ProjectRepository } from '../../src/infrastructure/project/types.js';

export function createInMemoryProjectRepository(): ProjectRepository {
  const projectsById = new Map<ProjectId, Project>();

  return {
    async save(project: Project): Promise<Project> {
      projectsById.set(project.id, project);
      return project;
    },

    async findById(id: ProjectId): Promise<Project | null> {
      return projectsById.get(id) ?? null;
    },

    async findByOwnerId(ownerId: UserId): Promise<Project[]> {
      return [...projectsById.values()]
        .filter((project) => project.ownerId === ownerId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async update(project: Project): Promise<Project> {
      projectsById.set(project.id, project);
      return project;
    },

    async delete(id: ProjectId): Promise<void> {
      projectsById.delete(id);
    },
  };
}
