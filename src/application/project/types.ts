import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type {
  ListProjectsResponseDto,
  ProjectResponseDto,
} from './dto/index.js';

export type ProjectUseCaseDependencies = {
  projectRepository: ProjectRepository;
};

export type ProjectUseCases = {
  create(input: unknown): Promise<ProjectResponseDto>;
  list(input: unknown): Promise<ListProjectsResponseDto>;
  get(input: unknown): Promise<ProjectResponseDto>;
  update(input: unknown): Promise<ProjectResponseDto>;
  delete(input: unknown): Promise<void>;
};

export type {
  CreateProjectInputDto,
  DeleteProjectInputDto,
  GetProjectInputDto,
  ListProjectsInputDto,
  ListProjectsResponseDto,
  ProjectResponseDto,
  UpdateProjectInputDto,
} from './dto/index.js';
