import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors.js';
import {
  InvalidTaskDescriptionError,
  InvalidTaskStatusError,
  InvalidTaskTitleError,
  TaskNotFoundError,
  UnauthorizedTaskAccessError,
} from './errors.js';

type TaskErrorClass = new (message?: string) => DomainError;

const TASK_ERRORS: ReadonlyArray<{
  ErrorClass: TaskErrorClass;
  code: string;
  defaultMessage: string;
}> = [
  {
    ErrorClass: TaskNotFoundError,
    code: 'TASK_NOT_FOUND',
    defaultMessage: 'Task not found',
  },
  {
    ErrorClass: UnauthorizedTaskAccessError,
    code: 'TASK_UNAUTHORIZED',
    defaultMessage: 'You do not have permission to access this task',
  },
  {
    ErrorClass: InvalidTaskTitleError,
    code: 'TASK_INVALID_TITLE',
    defaultMessage: 'Invalid task title',
  },
  {
    ErrorClass: InvalidTaskDescriptionError,
    code: 'TASK_INVALID_DESCRIPTION',
    defaultMessage: 'Invalid task description',
  },
  {
    ErrorClass: InvalidTaskStatusError,
    code: 'TASK_INVALID_STATUS',
    defaultMessage: 'Invalid task status',
  },
];

describe('task domain errors', () => {
  it.each(TASK_ERRORS)(
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

  it.each(TASK_ERRORS)(
    '$ErrorClass.name accepts a custom message',
    ({ ErrorClass, code }) => {
      const customMessage = `custom ${ErrorClass.name} message`;
      const error = new ErrorClass(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.code).toBe(code);
    },
  );

  describe('error hierarchy', () => {
    it('UnauthorizedTaskAccessError is catchable as DomainError and Error', () => {
      const error: unknown = new UnauthorizedTaskAccessError();

      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('TaskNotFoundError preserves code when thrown from a use case path', () => {
      const throwNotFound = (): void => {
        throw new TaskNotFoundError();
      };

      expect(throwNotFound).toThrow(TaskNotFoundError);
      expect(throwNotFound).toThrow(
        expect.objectContaining({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        }),
      );
    });
  });
});
