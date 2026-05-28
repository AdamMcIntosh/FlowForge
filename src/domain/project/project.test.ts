import { beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidProjectDescriptionError,
  InvalidProjectNameError,
  ProjectOwnershipError,
} from './errors.js';
import { Project } from './project.js';

describe('Project', () => {
  const ownerId = 'user-1';

  describe('validateName', () => {
    it('returns trimmed name for valid input', () => {
      expect(Project.validateName('  FlowForge  ')).toBe('FlowForge');
    });

    it('throws InvalidProjectNameError for empty names after trimming', () => {
      expect(() => Project.validateName('   ')).toThrow(
        new InvalidProjectNameError('Project name is required'),
      );
    });

    it('throws InvalidProjectNameError for names longer than 255 characters', () => {
      expect(() => Project.validateName('a'.repeat(256))).toThrow(
        new InvalidProjectNameError('Project name must be at most 255 characters'),
      );
    });

    it('accepts names at exactly 255 characters', () => {
      expect(Project.validateName('a'.repeat(255))).toHaveLength(255);
    });
  });

  describe('validateDescription', () => {
    it('returns trimmed description for valid input', () => {
      expect(Project.validateDescription('  A short summary  ')).toBe('A short summary');
    });

    it('returns null for null, undefined, or whitespace-only descriptions', () => {
      expect(Project.validateDescription(null)).toBeNull();
      expect(Project.validateDescription(undefined)).toBeNull();
      expect(Project.validateDescription('   ')).toBeNull();
    });

    it('throws InvalidProjectDescriptionError for descriptions longer than 2000 characters', () => {
      expect(() => Project.validateDescription('a'.repeat(2001))).toThrow(
        new InvalidProjectDescriptionError(
          'Project description must be at most 2000 characters',
        ),
      );
    });

    it('accepts descriptions at exactly 2000 characters', () => {
      expect(Project.validateDescription('a'.repeat(2000))).toHaveLength(2000);
    });
  });

  describe('create', () => {
    it('normalizes name and description', () => {
      const project = Project.create({
        id: 'project-1',
        name: '  My Project  ',
        description: '  Summary  ',
        ownerId,
      });

      expect(project.name).toBe('My Project');
      expect(project.description).toBe('Summary');
      expect(project.id).toBe('project-1');
      expect(project.ownerId).toBe(ownerId);
      expect(project.createdAt).toEqual(project.updatedAt);
    });

    it('defaults description to null when omitted', () => {
      const project = Project.create({
        id: 'project-1',
        name: 'My Project',
        ownerId,
      });

      expect(project.description).toBeNull();
    });

    it('uses the provided createdAt for both timestamps when supplied', () => {
      const createdAt = new Date('2024-06-15T10:00:00.000Z');

      const project = Project.create({
        id: 'project-1',
        name: 'My Project',
        ownerId,
        createdAt,
      });

      expect(project.createdAt).toBe(createdAt);
      expect(project.updatedAt).toBe(createdAt);
    });

    it('rejects empty names after trimming', () => {
      expect(() =>
        Project.create({
          id: 'project-1',
          name: '   ',
          ownerId,
        }),
      ).toThrow(new InvalidProjectNameError('Project name is required'));
    });
  });

  describe('reconstitute', () => {
    it('re-applies normalization from persistence', () => {
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-01-02T00:00:00.000Z');

      const project = Project.reconstitute({
        id: 'project-1',
        name: '  Stored Project  ',
        description: '  Stored summary  ',
        ownerId,
        createdAt,
        updatedAt,
      });

      expect(project.name).toBe('Stored Project');
      expect(project.description).toBe('Stored summary');
      expect(project.createdAt).toBe(createdAt);
      expect(project.updatedAt).toBe(updatedAt);
    });

    it('rejects invalid name on reconstitute', () => {
      expect(() =>
        Project.reconstitute({
          id: 'project-1',
          name: '  ',
          description: null,
          ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidProjectNameError);
    });
  });

  describe('ownership', () => {
    let project: Project;

    beforeEach(() => {
      project = Project.create({
        id: 'project-1',
        name: 'My Project',
        ownerId,
      });
    });

    it('isOwnedBy returns true for the owner', () => {
      expect(project.isOwnedBy(ownerId)).toBe(true);
    });

    it('isOwnedBy returns false for a different user', () => {
      expect(project.isOwnedBy('user-2')).toBe(false);
    });

    it('assertOwnedBy does not throw for the owner', () => {
      expect(() => project.assertOwnedBy(ownerId)).not.toThrow();
    });

    it('assertOwnedBy throws ProjectOwnershipError for a different user', () => {
      expect(() => project.assertOwnedBy('user-2')).toThrow(ProjectOwnershipError);
    });
  });

  describe('update', () => {
    let project: Project;

    beforeEach(() => {
      project = Project.create({
        id: 'project-1',
        name: 'Original Name',
        description: 'Original description',
        ownerId,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      });
    });

    it('updates name and description while preserving id, owner, and createdAt', () => {
      const updated = project.update({
        name: '  Updated Name  ',
        description: '  Updated description  ',
      });

      expect(updated.id).toBe(project.id);
      expect(updated.ownerId).toBe(project.ownerId);
      expect(updated.createdAt).toBe(project.createdAt);
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
    });

    it('leaves unspecified fields unchanged', () => {
      const updated = project.update({ name: 'Renamed Only' });

      expect(updated.name).toBe('Renamed Only');
      expect(updated.description).toBe('Original description');
    });

    it('sets description to null when cleared with an empty string', () => {
      const updated = project.update({ description: '   ' });

      expect(updated.description).toBeNull();
    });

    it('advances updatedAt on every update', () => {
      const before = Date.now();
      const updated = project.update({ name: 'New Name' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(project.updatedAt.getTime());
    });

    it('rejects invalid name updates', () => {
      expect(() => project.update({ name: '   ' })).toThrow(InvalidProjectNameError);
    });
  });

  describe('toProps', () => {
    it('returns a snapshot of entity state', () => {
      const project = Project.create({
        id: 'project-1',
        name: 'My Project',
        description: 'Summary',
        ownerId,
      });

      expect(project.toProps()).toEqual({
        id: 'project-1',
        name: 'My Project',
        description: 'Summary',
        ownerId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    });
  });
});
