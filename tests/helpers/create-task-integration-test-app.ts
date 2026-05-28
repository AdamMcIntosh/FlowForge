/**
 * HTTP integration test app for Task CRUD — in-memory project + task repositories only.
 *
 * Call from `beforeEach` so each test gets isolated repositories (no PostgreSQL/SQLite).
 */
import {
  createAuthTestApp,
  type AuthTestApp,
} from './create-auth-test-app.js';
import { createInMemoryProjectRepository } from './in-memory-project-repository.js';
import { createInMemoryTaskRepository } from './in-memory-task-repository.js';

export type TaskIntegrationTestApp = AuthTestApp;

/** Fresh in-memory project + task repositories wired into buildServer(). */
export async function createTaskIntegrationTestApp(): Promise<TaskIntegrationTestApp> {
  return createAuthTestApp({
    projectRepository: createInMemoryProjectRepository(),
    taskRepository: createInMemoryTaskRepository(),
  });
}
