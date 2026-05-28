import { describe, expect, it, vi } from 'vitest';

import { InvalidProjectNameError } from '../../domain/index.js';
import { Project } from '../../domain/project/project.js';
import type { ProjectRepository } from '../../infrastructure/project/types.js';
import { createCreateProjectUseCase } from './create.use-case.js';

function createTestDeps(overrides?: { projectRepository?: Partial<ProjectRepository> }) {
  const projectRepository: ProjectRepository = {
    save: vi.fn(async (project) => project),
    findById: vi.fn(),
    findByOwnerId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides?.projectRepository,
  };

  return { projectRepository };
}

describe('createCreateProjectUseCase', () => {
  it('creates a project and returns a mapped response DTO', async () => {
    const deps = createTestDeps();
    const createProject = createCreateProjectUseCase(deps);

    const result = await createProject({
      ownerId: 'user-1',
      name: '  My Project  ',
      description: '  Summary  ',
    });

    expect(result).toEqual({
      id: expect.any(String),
      name: 'My Project',
      description: 'Summary',
      ownerId: 'user-1',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(deps.projectRepository.save).toHaveBeenCalledTimes(1);

    const savedProject = vi.mocked(deps.projectRepository.save).mock.calls[0]?.[0];
    expect(savedProject).toBeInstanceOf(Project);
    expect(savedProject?.name).toBe('My Project');
    expect(savedProject?.description).toBe('Summary');
    expect(savedProject?.ownerId).toBe('user-1');
  });

  it('assigns a unique id to each created project', async () => {
    const deps = createTestDeps();
    const createProject = createCreateProjectUseCase(deps);

    const first = await createProject({
      ownerId: 'user-1',
      name: 'First Project',
    });
    const second = await createProject({
      ownerId: 'user-1',
      name: 'Second Project',
    });

    expect(first.id).not.toBe(second.id);
  });

  it('defaults description to null when omitted', async () => {
    const deps = createTestDeps();
    const createProject = createCreateProjectUseCase(deps);

    const result = await createProject({
      ownerId: 'user-1',
      name: 'My Project',
    });

    expect(result.description).toBeNull();
  });

  it('throws InvalidProjectNameError when domain name validation fails', async () => {
    const deps = createTestDeps();
    const createProject = createCreateProjectUseCase(deps);

    await expect(
      createProject({
        ownerId: 'user-1',
        name: '   ',
      }),
    ).rejects.toThrow(InvalidProjectNameError);

    expect(deps.projectRepository.save).not.toHaveBeenCalled();
  });

  it('returns ISO datetime strings for timestamps', async () => {
    const deps = createTestDeps();
    const createProject = createCreateProjectUseCase(deps);

    const result = await createProject({
      ownerId: 'user-1',
      name: 'My Project',
    });

    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.createdAt).toBe(result.updatedAt);
  });
});
