import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PrismaClient as AppPrismaClient } from '@prisma/client';
import { PrismaClient as TestPrismaClient } from '../../generated/prisma-test-client/index.js';

import {
  createUniqueTestDatabaseUrl,
  testPrismaSchemaPath,
} from './test-database-config.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const schemaPushedUrls = new Set<string>();

function ensureTestSchema(databaseUrl: string): void {
  if (schemaPushedUrls.has(databaseUrl)) {
    return;
  }

  execSync(
    `npx prisma db push --schema="${testPrismaSchemaPath}" --skip-generate --accept-data-loss`,
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );

  schemaPushedUrls.add(databaseUrl);
}

export type TestDatabase = {
  databaseUrl: string;
  prisma: AppPrismaClient;
  connectDatabase: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
};

export function createTestDatabase(): TestDatabase {
  const databaseUrl = createUniqueTestDatabaseUrl();
  ensureTestSchema(databaseUrl);

  const prisma = new TestPrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  return {
    databaseUrl,
    prisma: prisma as unknown as AppPrismaClient,
    async connectDatabase(): Promise<void> {
      await prisma.$connect();
    },
    async disconnectDatabase(): Promise<void> {
      await prisma.$disconnect();
    },
  };
}
