/**
 * Shared fixtures for Task application-layer unit tests.
 *
 * Setup: call `createFreshTaskUseCaseDeps()` inside `beforeEach` so each test
 * gets isolated in-memory task + project repositories (no PostgreSQL).
 * Use `seedOwnedProject` / `seedTask` to populate data before invoking use cases.
 */
import { Project } from '../../src/domain/project/project.js';
import { Task, TaskStatus } from '../../src/domain/index.js';
import { createInMemoryProjectRepository } from './in-memory-project-repository.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';
export const DEFAULT_CREATED_AT = new Date('2025-01-01T00:00:00.000Z');
/** Fresh in-memory repositories — call inside `beforeEach` to avoid cross-test leakage. */
export function createFreshTaskUseCaseDeps() {
    return {
        taskRepository: createInMemoryTaskRepository(),
        projectRepository: createInMemoryProjectRepository(),
    };
}
export async function seedOwnedProject(projectRepository, options) {
    const project = Project.create({
        id: options?.id ?? 'project-1',
        name: options?.name ?? 'Task Project',
        ownerId: options?.ownerId ?? 'user-1',
        createdAt: DEFAULT_CREATED_AT,
    });
    return projectRepository.save(project);
}
export async function seedTask(taskRepository, options) {
    const task = Task.reconstitute({
        id: options?.id ?? 'task-1',
        title: options?.title ?? 'My Task',
        description: options?.description ?? 'Details',
        status: options?.status ?? TaskStatus.TODO,
        projectId: options?.projectId ?? 'project-1',
        assigneeId: options?.assigneeId ?? null,
        createdAt: options?.createdAt ?? DEFAULT_CREATED_AT,
        updatedAt: options?.updatedAt ?? DEFAULT_CREATED_AT,
    });
    return taskRepository.save(task);
}
//# sourceMappingURL=task-use-case-fixtures.js.map