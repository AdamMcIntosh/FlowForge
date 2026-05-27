import { ZodError } from 'zod';

import { DomainError } from '../../domain/errors.js';
import {
  InvalidCredentialsError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  UserAlreadyExistsError,
} from '../../domain/index.js';

export type AuthHttpError = {
  statusCode: number;
  message: string;
  code?: string;
};

export function mapAuthError(error: unknown): AuthHttpError {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      statusCode: 400,
      message: firstIssue?.message ?? 'Validation failed',
      code: 'VALIDATION_ERROR',
    };
  }

  if (error instanceof InvalidCredentialsError) {
    return { statusCode: 401, message: error.message, code: error.code };
  }

  if (error instanceof UserAlreadyExistsError) {
    return { statusCode: 409, message: error.message, code: error.code };
  }

  if (error instanceof InvalidPasswordError) {
    return { statusCode: 400, message: error.message, code: error.code };
  }

  if (error instanceof InvalidRefreshTokenError) {
    return { statusCode: 401, message: error.message, code: error.code };
  }

  if (error instanceof DomainError) {
    return { statusCode: 400, message: error.message, code: error.code };
  }

  return { statusCode: 500, message: 'Internal Server Error' };
}
