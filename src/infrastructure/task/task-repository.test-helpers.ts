import type { PrismaClient, TaskStatus as PrismaTaskStatus } from '@prisma/client';
import { vi } from 'vitest';

import { TaskStatus } from '../../domain/task/task-status.js';

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  status: PrismaTaskStatus;
  projectId: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const defaultProjectId = 'project-1';
export const otherProjectId = 'project-2';
export const assigneeId = 'user-2';

export function createTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Fix login',
    description: 'Repro steps',
    status: TaskStatus.TODO,
    projectId: defaultProjectId,
    assigneeId,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function createMockPrismaClient() {
  return {
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient;
}

export function echoCreateFromData(data: {
  id: string;
  title: string;
  description: string | null;
  status: PrismaTaskStatus;
  projectId: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskRecord {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    projectId: data.projectId,
    assigneeId: data.assigneeId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
