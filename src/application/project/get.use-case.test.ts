import { describe, expect, it, vi } from 'vitest';

import { ProjectNotFoundError, ProjectOwnershipError } from '../../domain/index.js';
import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import { createGetProjectUseCase } from './get.use-case.js';

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
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides?.projectRepository,
  };

  return { projectRepository };
}

describe('createGetProjectUseCase', () => {
  it('returns a mapped project when the user owns it', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const getProject = createGetProjectUseCase(deps);

    const result = await getProject({
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(result).toEqual({
      id: 'project-1',
      name: 'My Project',
      description: 'Summary',
      ownerId: 'user-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(deps.projectRepository.findById).toHaveBeenCalledWith('project-1');
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const getProject = createGetProjectUseCase(deps);

    await expect(
      getProject({
        projectId: 'missing-project',
        userId: 'user-1',
      }),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it('throws ProjectOwnershipError when the user does not own the project', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject('user-1')),
      },
    });
    const getProject = createGetProjectUseCase(deps);

    await expect(
      getProject({
        projectId: 'project-1',
        userId: 'user-2',
      }),
    ).rejects.toThrow(ProjectOwnershipError);
  });

  it('throws ProjectNotFoundError with PROJECT_NOT_FOUND code', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const getProject = createGetProjectUseCase(deps);

    let error: ProjectNotFoundError | undefined;

    try {
      await getProject({
        projectId: 'missing-project',
        userId: 'user-1',
      });
    } catch (caught) {
      error = caught as ProjectNotFoundError;
    }

    expect(error?.code).toBe('PROJECT_NOT_FOUND');
  });
});
