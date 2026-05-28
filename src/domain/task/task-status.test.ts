import { describe, expect, it } from 'vitest';

import { InvalidTaskStatusError } from './errors.js';
import {
  TASK_STATUSES,
  TASK_STATUS_DONE,
  TASK_STATUS_IN_PROGRESS,
  TASK_STATUS_TODO,
  TaskStatus,
  isTaskStatus,
  parseTaskStatus,
} from './task-status.js';

describe('TaskStatus', () => {
  it('exposes all Prisma-aligned status values', () => {
    expect(TASK_STATUSES).toEqual(['TODO', 'IN_PROGRESS', 'DONE']);
    expect(TASK_STATUSES).toHaveLength(3);
    expect(TaskStatus.TODO).toBe('TODO');
    expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(TaskStatus.DONE).toBe('DONE');
    expect(TASK_STATUSES).toContain(TaskStatus.TODO);
    expect(TASK_STATUSES).toContain(TaskStatus.IN_PROGRESS);
    expect(TASK_STATUSES).toContain(TaskStatus.DONE);
  });

  it('exports individual constants aligned with the TaskStatus object', () => {
    expect(TASK_STATUS_TODO).toBe(TaskStatus.TODO);
    expect(TASK_STATUS_IN_PROGRESS).toBe(TaskStatus.IN_PROGRESS);
    expect(TASK_STATUS_DONE).toBe(TaskStatus.DONE);
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
      expect(isTaskStatus(' TODO ')).toBe(false);
      expect(isTaskStatus('IN PROGRESS')).toBe(false);
    });

    it('narrows the type for valid values', () => {
      const value = 'DONE';
      if (isTaskStatus(value)) {
        expect(parseTaskStatus(value)).toBe(TaskStatus.DONE);
      } else {
        throw new Error('expected isTaskStatus to narrow DONE');
      }
    });
  });

  describe('parseTaskStatus', () => {
    it.each([
      ['TODO', TaskStatus.TODO],
      ['IN_PROGRESS', TaskStatus.IN_PROGRESS],
      ['DONE', TaskStatus.DONE],
    ] as const)('parses %s', (input, expected) => {
      expect(parseTaskStatus(input)).toBe(expected);
    });

    it('throws InvalidTaskStatusError for invalid input', () => {
      expect(() => parseTaskStatus('ARCHIVED')).toThrow(InvalidTaskStatusError);
      expect(() => parseTaskStatus('ARCHIVED')).toThrow(
        new InvalidTaskStatusError('Invalid task status: ARCHIVED'),
      );
    });

    it('throws for empty and whitespace-padded values', () => {
      expect(() => parseTaskStatus('')).toThrow(InvalidTaskStatusError);
      expect(() => parseTaskStatus(' TODO ')).toThrow(
        new InvalidTaskStatusError('Invalid task status:  TODO '),
      );
    });
  });
});
