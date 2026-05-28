import type { Project } from '../../domain/index.js';
import type { ProjectResponseDto } from './dto/index.js';

export function toProjectResponse(project: Project): ProjectResponseDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
