import { DomainError } from '../errors.js';

export class ProjectNotFoundError extends DomainError {
  constructor(message = 'Project not found') {
    super(message, 'PROJECT_NOT_FOUND');
  }
}

export class ProjectOwnershipError extends DomainError {
  constructor(message = 'You do not have permission to access this project') {
    super(message, 'PROJECT_OWNERSHIP');
  }
}

export class InvalidProjectNameError extends DomainError {
  constructor(message = 'Invalid project name') {
    super(message, 'PROJECT_INVALID_NAME');
  }
}

export class InvalidProjectDescriptionError extends DomainError {
  constructor(message = 'Invalid project description') {
    super(message, 'PROJECT_INVALID_DESCRIPTION');
  }
}
