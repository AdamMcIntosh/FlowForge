import { InvalidTaskStatusError } from './errors.js';

export const TASK_STATUS_TODO = 'TODO' as const;
export const TASK_STATUS_IN_PROGRESS = 'IN_PROGRESS' as const;
export const TASK_STATUS_DONE = 'DONE' as const;

export const TaskStatus = {
  TODO: TASK_STATUS_TODO,
  IN_PROGRESS: TASK_STATUS_IN_PROGRESS,
  DONE: TASK_STATUS_DONE,
} as const;

export type TaskStatusValue = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TASK_STATUSES: readonly TaskStatusValue[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.DONE,
];

export function isTaskStatus(value: string): value is TaskStatusValue {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export function parseTaskStatus(value: string): TaskStatusValue {
  if (!isTaskStatus(value)) {
    throw new InvalidTaskStatusError(`Invalid task status: ${value}`);
  }

  return value;
}
