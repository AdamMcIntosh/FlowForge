import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import {
  InvalidCredentialsError,
  InvalidEmailError,
  InvalidNameError,
  InvalidPasswordError,
  InvalidRefreshTokenError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from './errors.js';

type AuthErrorClass = new (message?: string) => DomainError;

const AUTH_ERRORS: ReadonlyArray<{
  ErrorClass: AuthErrorClass;
  code: string;
  defaultMessage: string;
}> = [
  {
    ErrorClass: InvalidCredentialsError,
    code: 'AUTH_INVALID_CREDENTIALS',
    defaultMessage: 'Invalid email or password',
  },
  {
    ErrorClass: UserAlreadyExistsError,
    code: 'AUTH_USER_ALREADY_EXISTS',
    defaultMessage: 'A user with this email already exists',
  },
  {
    ErrorClass: InvalidPasswordError,
    code: 'AUTH_INVALID_PASSWORD',
    defaultMessage: 'Password does not meet requirements',
  },
  {
    ErrorClass: InvalidRefreshTokenError,
    code: 'AUTH_INVALID_REFRESH_TOKEN',
    defaultMessage: 'Invalid or expired refresh token',
  },
  {
    ErrorClass: UserNotFoundError,
    code: 'AUTH_USER_NOT_FOUND',
    defaultMessage: 'User not found',
  },
  {
    ErrorClass: InvalidEmailError,
    code: 'AUTH_INVALID_EMAIL',
    defaultMessage: 'Invalid email address',
  },
  {
    ErrorClass: InvalidNameError,
    code: 'AUTH_INVALID_NAME',
    defaultMessage: 'Invalid name',
  },
];

describe('auth domain errors', () => {
  it.each(AUTH_ERRORS)(
    '$ErrorClass.name exposes stable code and default message',
    ({ ErrorClass, code, defaultMessage }) => {
      const error = new ErrorClass();

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(ErrorClass.name);
      expect(error.code).toBe(code);
      expect(error.message).toBe(defaultMessage);
    },
  );

  it.each(AUTH_ERRORS)(
    '$ErrorClass.name accepts a custom message',
    ({ ErrorClass, code }) => {
      const customMessage = `custom ${ErrorClass.name} message`;
      const error = new ErrorClass(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.code).toBe(code);
    },
  );

  describe('error hierarchy', () => {
    it('InvalidCredentialsError is catchable as DomainError and Error', () => {
      const error: unknown = new InvalidCredentialsError();

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('InvalidPasswordError preserves code when thrown from validation', () => {
      const throwPasswordError = (): void => {
        throw new InvalidPasswordError('Password must be at least 8 characters');
      };

      expect(throwPasswordError).toThrow(InvalidPasswordError);
      expect(throwPasswordError).toThrow(
        expect.objectContaining({
          code: 'AUTH_INVALID_PASSWORD',
          message: 'Password must be at least 8 characters',
        }),
      );
    });
  });
});
