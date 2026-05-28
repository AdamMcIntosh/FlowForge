import { describe, expect, it, vi } from 'vitest';

import {
  InvalidProjectDescriptionError,
  InvalidProjectNameError,
  ProjectNotFoundError,
  ProjectOwnershipError,
} from '../../domain/index.js';
import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import { createUpdateProjectUseCase } from './update.use-case.js';

function createTestProject(ownerId = 'user-1'): Project {
  return Project.create({
    id: 'project-1',
    name: 'My Project',
    description: 'Summary',
    ownerId,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });
}

function createTestDeps(overrides?: { projectRepository?: Partial<ProjectRepository> }) {
  const projectRepository: ProjectRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByOwnerId: vi.fn(),
    update: vi.fn(async (project) => project),
    delete: vi.fn(),
    ...overrides?.projectRepository,
  };

  return { projectRepository };
}

describe('createUpdateProjectUseCase', () => {
  it('updates name and description and returns a mapped response DTO', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    const result = await updateProject({
      projectId: 'project-1',
      userId: 'user-1',
      name: '  Updated Name  ',
      description: '  Updated Summary  ',
    });

    expect(result).toEqual({
      id: 'project-1',
      name: 'Updated Name',
      description: 'Updated Summary',
      ownerId: 'user-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: expect.any(String),
    });
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(deps.projectRepository.findById).toHaveBeenCalledWith('project-1');
    expect(deps.projectRepository.update).toHaveBeenCalledTimes(1);

    const savedProject = vi.mocked(deps.projectRepository.update).mock.calls[0]?.[0];
    expect(savedProject).toBeInstanceOf(Project);
    expect(savedProject?.name).toBe('Updated Name');
    expect(savedProject?.description).toBe('Updated Summary');
    expect(savedProject?.ownerId).toBe('user-1');
  });

  it('updates only the name when description is omitted', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    const result = await updateProject({
      projectId: 'project-1',
      userId: 'user-1',
      name: 'Renamed Project',
    });

    expect(result.name).toBe('Renamed Project');
    expect(result.description).toBe('Summary');

    const savedProject = vi.mocked(deps.projectRepository.update).mock.calls[0]?.[0];
    expect(savedProject?.description).toBe('Summary');
  });

  it('updates only the description when name is omitted', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    const result = await updateProject({
      projectId: 'project-1',
      userId: 'user-1',
      description: 'New description only',
    });

    expect(result.name).toBe('My Project');
    expect(result.description).toBe('New description only');
  });

  it('clears description when null is provided', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    const result = await updateProject({
      projectId: 'project-1',
      userId: 'user-1',
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it('maps repository timestamps to ISO strings via toProjectResponse', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
        update: vi.fn(async (updated) => updated),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    const result = await updateProject({
      projectId: 'project-1',
      userId: 'user-1',
      name: 'Updated',
    });

    expect(result.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(result.updatedAt).not.toBe(result.createdAt);
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    await expect(
      updateProject({
        projectId: 'missing-project',
        userId: 'user-1',
        name: 'Updated',
      }),
    ).rejects.toThrow(ProjectNotFoundError);

    expect(deps.projectRepository.update).not.toHaveBeenCalled();
  });

  it('throws ProjectNotFoundError with PROJECT_NOT_FOUND code', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    let error: ProjectNotFoundError | undefined;

    try {
      await updateProject({
        projectId: 'missing-project',
        userId: 'user-1',
        name: 'Updated',
      });
    } catch (caught) {
      error = caught as ProjectNotFoundError;
    }

    expect(error?.code).toBe('PROJECT_NOT_FOUND');
  });

  it('throws ProjectOwnershipError when the user does not own the project', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject('user-1')),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    await expect(
      updateProject({
        projectId: 'project-1',
        userId: 'user-2',
        name: 'Updated',
      }),
    ).rejects.toThrow(ProjectOwnershipError);

    expect(deps.projectRepository.update).not.toHaveBeenCalled();
  });

  it('throws InvalidProjectNameError when domain name validation fails', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject()),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    await expect(
      updateProject({
        projectId: 'project-1',
        userId: 'user-1',
        name: '   ',
      }),
    ).rejects.toThrow(InvalidProjectNameError);

    expect(deps.projectRepository.update).not.toHaveBeenCalled();
  });

  it('throws InvalidProjectDescriptionError when description exceeds max length', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject()),
      },
    });
    const updateProject = createUpdateProjectUseCase(deps);

    await expect(
      updateProject({
        projectId: 'project-1',
        userId: 'user-1',
        description: 'a'.repeat(2001),
      }),
    ).rejects.toThrow(InvalidProjectDescriptionError);

    expect(deps.projectRepository.update).not.toHaveBeenCalled();
  });
});
