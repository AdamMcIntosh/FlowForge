import { TaskStatus } from '../../domain/task/task-status.js';
import { Task, type CreateTaskInput } from '../../domain/task/task.js';
import {
  assigneeId,
  defaultProjectId,
  otherProjectId,
} from './task-repository.test-helpers.js';

export { assigneeId, defaultProjectId, otherProjectId };

export function createTestTask(overrides: Partial<CreateTaskInput> = {}): Task {
  return Task.create({
    id: 'task-1',
    title: 'Fix login',
    description: 'Repro steps',
    status: TaskStatus.TODO,
    projectId: defaultProjectId,
    assigneeId,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

export function reconstituteTestTask(
  overrides: Partial<ReturnType<Task['toProps']>> = {},
): Task {
  const base = createTestTask().toProps();

  return Task.reconstitute({
    ...base,
    ...overrides,
  });
}
