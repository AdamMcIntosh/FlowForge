import { DomainError } from '../errors.js';

export class TaskNotFoundError extends DomainError {
  constructor(message = 'Task not found') {
    super(message, 'TASK_NOT_FOUND');
  }
}

export class UnauthorizedTaskAccessError extends DomainError {
  constructor(message = 'You do not have permission to access this task') {
    super(message, 'TASK_UNAUTHORIZED');
  }
}

export class InvalidTaskTitleError extends DomainError {
  constructor(message = 'Invalid task title') {
    super(message, 'TASK_INVALID_TITLE');
  }
}

export class InvalidTaskDescriptionError extends DomainError {
  constructor(message = 'Invalid task description') {
    super(message, 'TASK_INVALID_DESCRIPTION');
  }
}

export class InvalidTaskStatusError extends DomainError {
  constructor(message = 'Invalid task status') {
    super(message, 'TASK_INVALID_STATUS');
  }
}
