/**
 * Shared fixtures for Task application-layer unit tests.
 *
 * Setup: call `createFreshTaskUseCaseDeps()` inside `beforeEach` so each test
 * gets isolated in-memory task + project repositories (no PostgreSQL).
 * Use `seedOwnedProject` / `seedTask` to populate data before invoking use cases.
 */
import { Project } from '../../src/domain/project/project.js';
import { Task, type TaskStatusValue } from '../../src/domain/index.js';
import type { ProjectRepository } from '../../src/infrastructure/project/types.js';
import type { TaskRepository } from '../../src/infrastructure/task/types.js';
export declare const DEFAULT_CREATED_AT: Date;
export type TaskUseCaseDeps = {
    taskRepository: TaskRepository;
    projectRepository: ProjectRepository;
};
/** Fresh in-memory repositories — call inside `beforeEach` to avoid cross-test leakage. */
export declare function createFreshTaskUseCaseDeps(): TaskUseCaseDeps;
export declare function seedOwnedProject(projectRepository: ProjectRepository, options?: {
    id?: string;
    ownerId?: string;
    name?: string;
}): Promise<Project>;
export type SeedTaskOptions = {
    id?: string;
    title?: string;
    description?: string | null;
    status?: TaskStatusValue;
    projectId?: string;
    assigneeId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
};
export declare function seedTask(taskRepository: TaskRepository, options?: SeedTaskOptions): Promise<Task>;
//# sourceMappingURL=task-use-case-fixtures.d.ts.map