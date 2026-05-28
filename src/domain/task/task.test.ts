import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidTaskDescriptionError,
  InvalidTaskStatusError,
  InvalidTaskTitleError,
  UnauthorizedTaskAccessError,
} from './errors.js';
import { TaskStatus, type TaskStatusValue } from './task-status.js';
import { Task } from './task.js';

describe('Task', () => {
  const projectId = 'project-1';
  const assigneeId = 'user-2';

  describe('validateTitle', () => {
    it('returns trimmed title for valid input', () => {
      expect(Task.validateTitle('  Fix login  ')).toBe('Fix login');
    });

    it('throws InvalidTaskTitleError for empty titles after trimming', () => {
      expect(() => Task.validateTitle('   ')).toThrow(
        new InvalidTaskTitleError('Task title is required'),
      );
    });

    it('throws InvalidTaskTitleError for titles longer than 255 characters', () => {
      expect(() => Task.validateTitle('a'.repeat(256))).toThrow(
        new InvalidTaskTitleError('Task title must be at most 255 characters'),
      );
    });

    it('accepts titles at exactly 255 characters', () => {
      expect(Task.validateTitle('a'.repeat(255))).toHaveLength(255);
    });
  });

  describe('validateDescription', () => {
    it('returns trimmed description for valid input', () => {
      expect(Task.validateDescription('  Details here  ')).toBe('Details here');
    });

    it('returns null for null, undefined, or whitespace-only descriptions', () => {
      expect(Task.validateDescription(null)).toBeNull();
      expect(Task.validateDescription(undefined)).toBeNull();
      expect(Task.validateDescription('   ')).toBeNull();
    });

    it('throws InvalidTaskDescriptionError for descriptions longer than 2000 characters', () => {
      expect(() => Task.validateDescription('a'.repeat(2001))).toThrow(
        new InvalidTaskDescriptionError(
          'Task description must be at most 2000 characters',
        ),
      );
    });

    it('accepts descriptions at exactly 2000 characters', () => {
      expect(Task.validateDescription('a'.repeat(2000))).toHaveLength(2000);
    });
  });

  describe('validateStatus', () => {
    it.each([
      ['TODO', TaskStatus.TODO],
      ['IN_PROGRESS', TaskStatus.IN_PROGRESS],
      ['DONE', TaskStatus.DONE],
    ] as const)('parses %s', (input, expected) => {
      expect(Task.validateStatus(input)).toBe(expected);
    });

    it('rejects invalid status strings', () => {
      expect(() => Task.validateStatus('BLOCKED')).toThrow(InvalidTaskStatusError);
    });
  });

  describe('create', () => {
    it('normalizes title and description with default TODO status', () => {
      const task = Task.create({
        id: 'task-1',
        title: '  Fix bug  ',
        description: '  Repro steps  ',
        projectId,
      });

      expect(task.title).toBe('Fix bug');
      expect(task.description).toBe('Repro steps');
      expect(task.status).toBe(TaskStatus.TODO);
      expect(task.projectId).toBe(projectId);
      expect(task.assigneeId).toBeNull();
      expect(task.createdAt).toEqual(task.updatedAt);
    });

    it('defaults description to null when omitted', () => {
      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        projectId,
      });

      expect(task.description).toBeNull();
    });

    it('accepts explicit status and assignee', () => {
      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        status: TaskStatus.IN_PROGRESS,
        projectId,
        assigneeId,
      });

      expect(task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task.assigneeId).toBe(assigneeId);
    });

    it('uses the provided createdAt for both timestamps when supplied', () => {
      const createdAt = new Date('2024-06-15T10:00:00.000Z');

      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        projectId,
        createdAt,
      });

      expect(task.createdAt).toBe(createdAt);
      expect(task.updatedAt).toBe(createdAt);
    });

    it('rejects empty titles after trimming', () => {
      expect(() =>
        Task.create({
          id: 'task-1',
          title: '   ',
          projectId,
        }),
      ).toThrow(new InvalidTaskTitleError('Task title is required'));
    });

    it('rejects descriptions longer than 2000 characters', () => {
      expect(() =>
        Task.create({
          id: 'task-1',
          title: 'Fix bug',
          description: 'a'.repeat(2001),
          projectId,
        }),
      ).toThrow(
        new InvalidTaskDescriptionError(
          'Task description must be at most 2000 characters',
        ),
      );
    });

    it('accepts titles at exactly 255 characters', () => {
      const title = 'a'.repeat(255);
      const task = Task.create({
        id: 'task-1',
        title,
        projectId,
      });

      expect(task.title).toHaveLength(255);
    });

    it('rejects titles longer than 255 characters', () => {
      expect(() =>
        Task.create({
          id: 'task-1',
          title: 'a'.repeat(256),
          projectId,
        }),
      ).toThrow(
        new InvalidTaskTitleError('Task title must be at most 255 characters'),
      );
    });

    it('accepts explicit null description and assigneeId', () => {
      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        description: null,
        projectId,
        assigneeId: null,
      });

      expect(task.description).toBeNull();
      expect(task.assigneeId).toBeNull();
    });

    it('rejects invalid status on create', () => {
      expect(() =>
        Task.create({
          id: 'task-1',
          title: 'Fix bug',
          status: 'BLOCKED' as TaskStatusValue,
          projectId,
        }),
      ).toThrow(InvalidTaskStatusError);
    });
  });

  describe('reconstitute', () => {
    it('re-applies normalization from persistence', () => {
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-01-02T00:00:00.000Z');

      const task = Task.reconstitute({
        id: 'task-1',
        title: '  Stored task  ',
        description: '  Stored details  ',
        status: TaskStatus.DONE,
        projectId,
        assigneeId,
        createdAt,
        updatedAt,
      });

      expect(task.title).toBe('Stored task');
      expect(task.description).toBe('Stored details');
      expect(task.status).toBe(TaskStatus.DONE);
      expect(task.assigneeId).toBe(assigneeId);
      expect(task.projectId).toBe(projectId);
      expect(task.createdAt).toBe(createdAt);
      expect(task.updatedAt).toBe(updatedAt);
    });

    it('rejects invalid title on reconstitute', () => {
      expect(() =>
        Task.reconstitute({
          id: 'task-1',
          title: '  ',
          description: null,
          status: TaskStatus.TODO,
          projectId,
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidTaskTitleError);
    });

    it('rejects invalid status on reconstitute', () => {
      expect(() =>
        Task.reconstitute({
          id: 'task-1',
          title: 'Valid title',
          description: null,
          status: 'ARCHIVED' as TaskStatusValue,
          projectId,
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidTaskStatusError);
    });

    it('normalizes whitespace-only description to null on reconstitute', () => {
      const task = Task.reconstitute({
        id: 'task-1',
        title: 'Valid title',
        description: '   ',
        status: TaskStatus.TODO,
        projectId,
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(task.description).toBeNull();
    });

    it('rejects invalid description on reconstitute', () => {
      expect(() =>
        Task.reconstitute({
          id: 'task-1',
          title: 'Valid title',
          description: 'a'.repeat(2001),
          status: TaskStatus.TODO,
          projectId,
          assigneeId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidTaskDescriptionError);
    });
  });

  describe('status transitions', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: 'task-1',
        title: 'Workflow task',
        projectId,
      });
    });

    it('transitions from TODO to IN_PROGRESS', () => {
      expect(task.status).toBe(TaskStatus.TODO);

      const inProgress = task.update({ status: TaskStatus.IN_PROGRESS });

      expect(inProgress.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task.status).toBe(TaskStatus.TODO);
    });

    it('transitions from IN_PROGRESS to DONE', () => {
      const inProgress = task.update({ status: TaskStatus.IN_PROGRESS });
      const done = inProgress.update({ status: TaskStatus.DONE });

      expect(done.status).toBe(TaskStatus.DONE);
    });

    it('allows direct transition from TODO to DONE', () => {
      const done = task.update({ status: TaskStatus.DONE });

      expect(done.status).toBe(TaskStatus.DONE);
    });

    it('rejects invalid status on update', () => {
      expect(() => task.update({ status: 'BLOCKED' as TaskStatusValue })).toThrow(
        InvalidTaskStatusError,
      );
    });
  });

  describe('assignee assignment', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: 'task-1',
        title: 'Assignable task',
        projectId,
      });
    });

    it('starts unassigned', () => {
      expect(task.assigneeId).toBeNull();
    });

    it('assigns a user on create', () => {
      const assigned = Task.create({
        id: 'task-2',
        title: 'Assigned task',
        projectId,
        assigneeId: 'user-3',
      });

      expect(assigned.assigneeId).toBe('user-3');
    });

    it('assigns a user via update', () => {
      const assigned = task.update({ assigneeId: 'user-3' });

      expect(assigned.assigneeId).toBe('user-3');
      expect(task.assigneeId).toBeNull();
    });

    it('reassigns to a different user', () => {
      const first = task.update({ assigneeId: 'user-3' });
      const second = first.update({ assigneeId: 'user-4' });

      expect(second.assigneeId).toBe('user-4');
    });

    it('clears assignee when set to null', () => {
      const assigned = task.update({ assigneeId: 'user-2' });
      const unassigned = assigned.update({ assigneeId: null });

      expect(unassigned.assigneeId).toBeNull();
    });
  });

  describe('project access', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        projectId,
      });
    });

    it('isInProject returns true for the owning project', () => {
      expect(task.isInProject(projectId)).toBe(true);
    });

    it('isInProject returns false for a different project', () => {
      expect(task.isInProject('project-2')).toBe(false);
    });

    it('assertInProject does not throw for the owning project', () => {
      expect(() => task.assertInProject(projectId)).not.toThrow();
    });

    it('assertInProject throws UnauthorizedTaskAccessError for a different project', () => {
      expect(() => task.assertInProject('project-2')).toThrow(UnauthorizedTaskAccessError);
    });
  });

  describe('project owner authorization', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        projectId,
      });
    });

    it('assertAccessibleByProjectOwner does not throw for the project owner', () => {
      expect(() => task.assertAccessibleByProjectOwner('owner-1', 'owner-1')).not.toThrow();
    });

    it('assertAccessibleByProjectOwner throws UnauthorizedTaskAccessError for other users', () => {
      expect(() => task.assertAccessibleByProjectOwner('owner-1', 'user-2')).toThrow(
        UnauthorizedTaskAccessError,
      );
    });
  });

  describe('update', () => {
    let task: Task;

    beforeEach(() => {
      task = Task.create({
        id: 'task-1',
        title: 'Original title',
        description: 'Original description',
        status: TaskStatus.TODO,
        projectId,
        assigneeId: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      });
    });

    it('cannot change projectId via update', () => {
      const updated = task.update({ title: 'Renamed' });

      expect(updated.projectId).toBe(projectId);
      expect(updated.projectId).toBe(task.projectId);
    });

    it('updates fields while preserving id, projectId, and createdAt', () => {
      const updated = task.update({
        title: '  Updated title  ',
        description: '  Updated description  ',
        status: TaskStatus.DONE,
        assigneeId,
      });

      expect(updated.id).toBe(task.id);
      expect(updated.projectId).toBe(task.projectId);
      expect(updated.createdAt).toBe(task.createdAt);
      expect(updated.title).toBe('Updated title');
      expect(updated.description).toBe('Updated description');
      expect(updated.status).toBe(TaskStatus.DONE);
      expect(updated.assigneeId).toBe(assigneeId);
    });

    it('leaves unspecified fields unchanged', () => {
      const updated = task.update({ title: 'Renamed only' });

      expect(updated.title).toBe('Renamed only');
      expect(updated.description).toBe('Original description');
      expect(updated.status).toBe(TaskStatus.TODO);
      expect(updated.assigneeId).toBeNull();
    });

    it('clears assignee when set to null', () => {
      const assigned = task.update({ assigneeId: 'user-2' });
      const unassigned = assigned.update({ assigneeId: null });

      expect(unassigned.assigneeId).toBeNull();
    });

    it('sets description to null when cleared with an empty string', () => {
      const updated = task.update({ description: '   ' });

      expect(updated.description).toBeNull();
    });

    it('rejects invalid title updates', () => {
      expect(() => task.update({ title: '   ' })).toThrow(InvalidTaskTitleError);
    });

    it('rejects invalid description updates', () => {
      expect(() => task.update({ description: 'a'.repeat(2001) })).toThrow(
        InvalidTaskDescriptionError,
      );
    });

    it('returns a new instance without mutating the original', () => {
      const updated = task.update({ title: 'New title' });

      expect(updated).not.toBe(task);
      expect(task.title).toBe('Original title');
      expect(updated.title).toBe('New title');
    });

    it('advances updatedAt on every update', () => {
      const before = Date.now();
      const updated = task.update({ title: 'New title' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('returns a new instance with advanced updatedAt when called with no changes', () => {
      const updated = task.update({});

      expect(updated).not.toBe(task);
      expect(updated.title).toBe(task.title);
      expect(updated.description).toBe(task.description);
      expect(updated.status).toBe(task.status);
      expect(updated.assigneeId).toBe(task.assigneeId);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });
  });

  describe('toProps', () => {
    it('returns a snapshot of entity state', () => {
      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        description: 'Details',
        status: TaskStatus.IN_PROGRESS,
        projectId,
        assigneeId,
      });

      expect(task.toProps()).toEqual({
        id: 'task-1',
        title: 'Fix bug',
        description: 'Details',
        status: TaskStatus.IN_PROGRESS,
        projectId,
        assigneeId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    });

    it('returns a detached copy that does not mutate when props are changed', () => {
      const task = Task.create({
        id: 'task-1',
        title: 'Fix bug',
        projectId,
      });

      const props = task.toProps();
      props.title = 'Mutated';

      expect(task.title).toBe('Fix bug');
    });
  });
});
