import { describe, expect, it, vi } from 'vitest';

import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import { createListProjectsUseCase } from './list.use-case.js';

function createTestProject(id: string, ownerId: string, name: string): Project {
  return Project.create({
    id,
    name,
    ownerId,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  });
}

function createTestDeps(overrides?: { projectRepository?: Partial<ProjectRepository> }) {
  const projectRepository: ProjectRepository = {
    save: vi.fn(),
    findById: vi.fn(),
    findByOwnerId: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides?.projectRepository,
  };

  return { projectRepository };
}

describe('createListProjectsUseCase', () => {
  it('returns mapped projects for the requested owner', async () => {
    const ownerProjects = [
      createTestProject('project-1', 'user-1', 'Alpha'),
      createTestProject('project-2', 'user-1', 'Beta'),
    ];
    const deps = createTestDeps({
      projectRepository: {
        findByOwnerId: vi.fn().mockResolvedValue(ownerProjects),
      },
    });
    const listProjects = createListProjectsUseCase(deps);

    const result = await listProjects({ ownerId: 'user-1' });

    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]).toEqual({
      id: 'project-1',
      name: 'Alpha',
      description: null,
      ownerId: 'user-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(deps.projectRepository.findByOwnerId).toHaveBeenCalledWith('user-1');
  });

  it('returns an empty list when the owner has no projects', async () => {
    const deps = createTestDeps();
    const listProjects = createListProjectsUseCase(deps);

    const result = await listProjects({ ownerId: 'user-1' });

    expect(result.projects).toEqual([]);
  });

  it('does not include projects belonging to other owners', async () => {
    const findByOwnerId = vi.fn().mockResolvedValue([
      createTestProject('project-1', 'user-2', 'Other User Project'),
    ]);
    const deps = createTestDeps({ projectRepository: { findByOwnerId } });
    const listProjects = createListProjectsUseCase(deps);

    const result = await listProjects({ ownerId: 'user-2' });

    expect(findByOwnerId).toHaveBeenCalledWith('user-2');
    expect(result.projects.every((project) => project.ownerId === 'user-2')).toBe(true);
  });
});
