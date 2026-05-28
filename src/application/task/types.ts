import type { ProjectRepository } from '../../infrastructure/project/types.js';
import type { TaskRepository } from '../../infrastructure/task/types.js';
import type { ListTasksResponseDto, TaskResponseDto } from './dto/index.js';

export type TaskUseCaseDependencies = {
  taskRepository: TaskRepository;
  projectRepository: ProjectRepository;
};

export type TaskUseCases = {
  create(input: unknown): Promise<TaskResponseDto>;
  list(input: unknown): Promise<ListTasksResponseDto>;
  get(input: unknown): Promise<TaskResponseDto>;
  update(input: unknown): Promise<TaskResponseDto>;
  assign(input: unknown): Promise<TaskResponseDto>;
  changeStatus(input: unknown): Promise<TaskResponseDto>;
  delete(input: unknown): Promise<void>;
};

export type {
  AssignTaskInputDto,
  ChangeTaskStatusInputDto,
  CreateTaskInputDto,
  DeleteTaskInputDto,
  GetTaskInputDto,
  ListTasksInputDto,
  ListTasksResponseDto,
  TaskResponseDto,
  UpdateTaskInputDto,
} from './dto/index.js';
