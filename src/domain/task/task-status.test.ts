import { describe, expect, it } from 'vitest';

import { InvalidTaskStatusError } from './errors.js';
import {
  TASK_STATUSES,
  TaskStatus,
  isTaskStatus,
  parseTaskStatus,
} from './task-status.js';

describe('TaskStatus', () => {
  it('exposes all Prisma-aligned status values', () => {
    expect(TASK_STATUSES).toEqual(['TODO', 'IN_PROGRESS', 'DONE']);
    expect(TaskStatus.TODO).toBe('TODO');
    expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(TaskStatus.DONE).toBe('DONE');
  });

  describe('isTaskStatus', () => {
    it('returns true for valid statuses', () => {
      expect(isTaskStatus('TODO')).toBe(true);
      expect(isTaskStatus('IN_PROGRESS')).toBe(true);
      expect(isTaskStatus('DONE')).toBe(true);
    });

    it('returns false for invalid statuses', () => {
      expect(isTaskStatus('PENDING')).toBe(false);
      expect(isTaskStatus('')).toBe(false);
      expect(isTaskStatus('todo')).toBe(false);
    });
  });

  describe('parseTaskStatus', () => {
    it('returns the status for valid input', () => {
      expect(parseTaskStatus('IN_PROGRESS')).toBe(TaskStatus.IN_PROGRESS);
    });

    it('throws InvalidTaskStatusError for invalid input', () => {
      expect(() => parseTaskStatus('ARCHIVED')).toThrow(InvalidTaskStatusError);
      expect(() => parseTaskStatus('ARCHIVED')).toThrow(
        new InvalidTaskStatusError('Invalid task status: ARCHIVED'),
      );
    });
  });
});
