import { ZodError } from 'zod';

import { DomainError } from '../../domain/errors.js';
import {
  InvalidTaskDescriptionError,
  InvalidTaskStatusError,
  InvalidTaskTitleError,
  ProjectNotFoundError,
  ProjectOwnershipError,
  TaskNotFoundError,
  UnauthorizedTaskAccessError,
} from '../../domain/index.js';

export type TaskHttpError = {
  statusCode: number;
  message: string;
  code?: string;
};

export function mapTaskError(error: unknown): TaskHttpError {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      statusCode: 400,
      message: firstIssue?.message ?? 'Validation failed',
      code: 'VALIDATION_ERROR',
    };
  }

  if (error instanceof TaskNotFoundError) {
    return { statusCode: 404, message: error.message, code: error.code };
  }

  if (error instanceof ProjectNotFoundError) {
    return { statusCode: 404, message: error.message, code: error.code };
  }

  if (error instanceof UnauthorizedTaskAccessError) {
    return { statusCode: 403, message: error.message, code: error.code };
  }

  if (error instanceof ProjectOwnershipError) {
    return { statusCode: 403, message: error.message, code: error.code };
  }

  if (error instanceof InvalidTaskTitleError) {
    return { statusCode: 422, message: error.message, code: error.code };
  }

  if (error instanceof InvalidTaskDescriptionError) {
    return { statusCode: 422, message: error.message, code: error.code };
  }

  if (error instanceof InvalidTaskStatusError) {
    return { statusCode: 422, message: error.message, code: error.code };
  }

  if (error instanceof DomainError) {
    return { statusCode: 400, message: error.message, code: error.code };
  }

  return { statusCode: 500, message: 'Internal Server Error' };
}
