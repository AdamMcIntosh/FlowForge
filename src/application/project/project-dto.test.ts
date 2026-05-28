import { describe, expect, it } from 'vitest';

import {
  createProjectInputSchema,
  deleteProjectInputSchema,
  getProjectInputSchema,
  listProjectsInputSchema,
  listProjectsResponseSchema,
  projectResponseSchema,
  updateProjectInputSchema,
} from './dto/index.js';

describe('project DTO schemas', () => {
  describe('createProjectInputSchema', () => {
    it('returns field-specific messages when required fields are missing', () => {
      const result = createProjectInputSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Owner id is required');
      }
    });

    it('validates create input with optional nullable description', () => {
      expect(
        createProjectInputSchema.safeParse({
          ownerId: 'user-1',
          name: 'My Project',
          description: 'Summary',
        }).success,
      ).toBe(true);

      expect(
        createProjectInputSchema.safeParse({
          ownerId: 'user-1',
          name: 'My Project',
          description: null,
        }).success,
      ).toBe(true);
    });

    it('rejects empty name after trimming', () => {
      const result = createProjectInputSchema.safeParse({
        ownerId: 'user-1',
        name: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Name is required');
      }
    });

    it('rejects names longer than 255 characters', () => {
      const result = createProjectInputSchema.safeParse({
        ownerId: 'user-1',
        name: 'a'.repeat(256),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Name must be at most 255 characters');
      }
    });

    it('rejects descriptions longer than 2000 characters', () => {
      const result = createProjectInputSchema.safeParse({
        ownerId: 'user-1',
        name: 'My Project',
        description: 'a'.repeat(2001),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'Description must be at most 2000 characters',
        );
      }
    });
  });

  describe('listProjectsInputSchema', () => {
    it('requires ownerId', () => {
      const result = listProjectsInputSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Owner id is required');
      }
    });

    it('accepts a valid ownerId', () => {
      expect(listProjectsInputSchema.safeParse({ ownerId: 'user-1' }).success).toBe(true);
    });
  });

  describe('getProjectInputSchema', () => {
    it('requires projectId and userId', () => {
      const result = getProjectInputSchema.safeParse({ projectId: 'project-1' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('User id is required');
      }
    });

    it('accepts valid identifiers', () => {
      expect(
        getProjectInputSchema.safeParse({
          projectId: 'project-1',
          userId: 'user-1',
        }).success,
      ).toBe(true);
    });
  });

  describe('updateProjectInputSchema', () => {
    it('requires at least one updatable field', () => {
      const result = updateProjectInputSchema.safeParse({
        projectId: 'project-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          'At least one field must be provided for update',
        );
      }
    });

    it('accepts partial name updates', () => {
      expect(
        updateProjectInputSchema.safeParse({
          projectId: 'project-1',
          userId: 'user-1',
          name: 'Updated Name',
        }).success,
      ).toBe(true);
    });

    it('accepts nullable description updates', () => {
      expect(
        updateProjectInputSchema.safeParse({
          projectId: 'project-1',
          userId: 'user-1',
          description: null,
        }).success,
      ).toBe(true);
    });

    it('rejects empty name after trimming', () => {
      const result = updateProjectInputSchema.safeParse({
        projectId: 'project-1',
        userId: 'user-1',
        name: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Name is required');
      }
    });
  });

  describe('deleteProjectInputSchema', () => {
    it('requires projectId and userId', () => {
      const result = deleteProjectInputSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Project id is required');
      }
    });

    it('accepts valid identifiers', () => {
      expect(
        deleteProjectInputSchema.safeParse({
          projectId: 'project-1',
          userId: 'user-1',
        }).success,
      ).toBe(true);
    });
  });

  describe('output schemas', () => {
    it('validates project response shape', () => {
      expect(
        projectResponseSchema.safeParse({
          id: 'project-1',
          name: 'My Project',
          description: null,
          ownerId: 'user-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }).success,
      ).toBe(true);

      expect(
        projectResponseSchema.safeParse({
          id: '',
          name: 'My Project',
          description: null,
          ownerId: 'user-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }).success,
      ).toBe(false);
    });

    it('validates list projects response shape', () => {
      expect(
        listProjectsResponseSchema.safeParse({
          projects: [
            {
              id: 'project-1',
              name: 'My Project',
              description: 'Summary',
              ownerId: 'user-1',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        }).success,
      ).toBe(true);
    });
  });
});
