import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { createTestDatabase, type TestDatabase } from './create-test-database.js';

export type SeededUser = {
  id: string;
  email: string;
  name: string;
};

export type SeededProject = {
  id: string;
  ownerId: string;
  name: string;
};

export type PrismaTestContext = {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
  disconnect: () => Promise<void>;
  seedUser: (overrides?: Partial<SeededUser>) => Promise<SeededUser>;
  seedProject: (
    ownerId: string,
    overrides?: Partial<Pick<SeededProject, 'id' | 'name'>>,
  ) => Promise<SeededProject>;
};

export async function createPrismaTestContext(): Promise<PrismaTestContext> {
  const database: TestDatabase = createTestDatabase();
  await database.connectDatabase();
  const { prisma } = database;

  return {
    prisma,

    async cleanup(): Promise<void> {
      await prisma.task.deleteMany();
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    },

    async disconnect(): Promise<void> {
      await database.disconnectDatabase();
    },

    async seedUser(overrides: Partial<SeededUser> = {}): Promise<SeededUser> {
      const id = overrides.id ?? randomUUID();
      const email = overrides.email ?? `user-${id}@example.com`;
      const name = overrides.name ?? 'Test User';

      await prisma.user.create({
        data: {
          id,
          email,
          name,
          password: 'integration-test-password-hash',
        },
      });

      return { id, email, name };
    },

    async seedProject(
      ownerId: string,
      overrides: Partial<Pick<SeededProject, 'id' | 'name'>> = {},
    ): Promise<SeededProject> {
      const id = overrides.id ?? randomUUID();
      const name = overrides.name ?? 'Test Project';

      await prisma.project.create({
        data: {
          id,
          name,
          ownerId,
        },
      });

      return { id, ownerId, name };
    },
  };
}
