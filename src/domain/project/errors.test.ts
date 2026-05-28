import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import {
  InvalidProjectDescriptionError,
  InvalidProjectNameError,
  ProjectNotFoundError,
  ProjectOwnershipError,
} from './errors.js';

type ProjectErrorClass = new (message?: string) => DomainError;

const PROJECT_ERRORS: ReadonlyArray<{
  ErrorClass: ProjectErrorClass;
  code: string;
  defaultMessage: string;
}> = [
  {
    ErrorClass: ProjectNotFoundError,
    code: 'PROJECT_NOT_FOUND',
    defaultMessage: 'Project not found',
  },
  {
    ErrorClass: ProjectOwnershipError,
    code: 'PROJECT_OWNERSHIP',
    defaultMessage: 'You do not have permission to access this project',
  },
  {
    ErrorClass: InvalidProjectNameError,
    code: 'PROJECT_INVALID_NAME',
    defaultMessage: 'Invalid project name',
  },
  {
    ErrorClass: InvalidProjectDescriptionError,
    code: 'PROJECT_INVALID_DESCRIPTION',
    defaultMessage: 'Invalid project description',
  },
];

describe('project domain errors', () => {
  it.each(PROJECT_ERRORS)(
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

  it.each(PROJECT_ERRORS)(
    '$ErrorClass.name accepts a custom message',
    ({ ErrorClass, code }) => {
      const customMessage = `custom ${ErrorClass.name} message`;
      const error = new ErrorClass(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.code).toBe(code);
    },
  );

  describe('error hierarchy', () => {
    it('ProjectOwnershipError is catchable as DomainError and Error', () => {
      const error: unknown = new ProjectOwnershipError();

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('ProjectNotFoundError preserves code when thrown from a use case path', () => {
      const throwNotFound = (): void => {
        throw new ProjectNotFoundError();
      };

      expect(throwNotFound).toThrow(ProjectNotFoundError);
      expect(throwNotFound).toThrow(
        expect.objectContaining({
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        }),
      );
    });
  });
});
