import { describe, expect, it, vi } from 'vitest';

import { ProjectNotFoundError, ProjectOwnershipError } from '../../domain/index.js';
import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import { createDeleteProjectUseCase } from './delete.use-case.js';

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
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides?.projectRepository,
  };

  return { projectRepository };
}

describe('createDeleteProjectUseCase', () => {
  it('deletes the project when the user owns it', async () => {
    const project = createTestProject();
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(project),
      },
    });
    const deleteProject = createDeleteProjectUseCase(deps);

    await deleteProject({
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(deps.projectRepository.findById).toHaveBeenCalledWith('project-1');
    expect(deps.projectRepository.delete).toHaveBeenCalledWith('project-1');
    expect(deps.projectRepository.delete).toHaveBeenCalledTimes(1);
  });

  it('resolves without a return value on success', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject()),
      },
    });
    const deleteProject = createDeleteProjectUseCase(deps);

    const result = await deleteProject({
      projectId: 'project-1',
      userId: 'user-1',
    });

    expect(result).toBeUndefined();
  });

  it('throws ProjectNotFoundError when the project does not exist', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const deleteProject = createDeleteProjectUseCase(deps);

    await expect(
      deleteProject({
        projectId: 'missing-project',
        userId: 'user-1',
      }),
    ).rejects.toThrow(ProjectNotFoundError);

    expect(deps.projectRepository.delete).not.toHaveBeenCalled();
  });

  it('throws ProjectNotFoundError with PROJECT_NOT_FOUND code', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });
    const deleteProject = createDeleteProjectUseCase(deps);

    let error: ProjectNotFoundError | undefined;

    try {
      await deleteProject({
        projectId: 'missing-project',
        userId: 'user-1',
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
    const deleteProject = createDeleteProjectUseCase(deps);

    await expect(
      deleteProject({
        projectId: 'project-1',
        userId: 'user-2',
      }),
    ).rejects.toThrow(ProjectOwnershipError);

    expect(deps.projectRepository.delete).not.toHaveBeenCalled();
  });

  it('throws ProjectOwnershipError with PROJECT_OWNERSHIP code', async () => {
    const deps = createTestDeps({
      projectRepository: {
        findById: vi.fn().mockResolvedValue(createTestProject('user-1')),
      },
    });
    const deleteProject = createDeleteProjectUseCase(deps);

    let error: ProjectOwnershipError | undefined;

    try {
      await deleteProject({
        projectId: 'project-1',
        userId: 'user-2',
      });
    } catch (caught) {
      error = caught as ProjectOwnershipError;
    }

    expect(error?.code).toBe('PROJECT_OWNERSHIP');
  });
});
