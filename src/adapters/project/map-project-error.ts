import { ZodError } from 'zod';

import { DomainError } from '../../domain/errors.js';
import {
  InvalidProjectDescriptionError,
  InvalidProjectNameError,
  ProjectNotFoundError,
  ProjectOwnershipError,
} from '../../domain/index.js';

export type ProjectHttpError = {
  statusCode: number;
  message: string;
  code?: string;
};

export function mapProjectError(error: unknown): ProjectHttpError {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      statusCode: 400,
      message: firstIssue?.message ?? 'Validation failed',
      code: 'VALIDATION_ERROR',
    };
  }

  if (error instanceof ProjectNotFoundError) {
    return { statusCode: 404, message: error.message, code: error.code };
  }

  if (error instanceof ProjectOwnershipError) {
    return { statusCode: 403, message: error.message, code: error.code };
  }

  if (error instanceof InvalidProjectNameError) {
    return { statusCode: 422, message: error.message, code: error.code };
  }

  if (error instanceof InvalidProjectDescriptionError) {
    return { statusCode: 422, message: error.message, code: error.code };
  }

  if (error instanceof DomainError) {
    return { statusCode: 400, message: error.message, code: error.code };
  }

  return { statusCode: 500, message: 'Internal Server Error' };
}
