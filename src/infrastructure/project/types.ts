import type { UserId } from '../../domain/auth/user.js';
import type { Project, ProjectId } from '../../domain/project/project.js';

export interface ProjectRepository {
  save(project: Project): Promise<Project>;
  findById(id: ProjectId): Promise<Project | null>;
  findByOwnerId(ownerId: UserId): Promise<Project[]>;
  update(project: Project): Promise<Project>;
  delete(id: ProjectId): Promise<void>;
}
