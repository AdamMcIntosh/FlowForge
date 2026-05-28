import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const testPrismaSchemaPath = path.join(repoRoot, 'prisma', 'schema.test.prisma');

/**
 * Creates a unique SQLite URL backed by a private in-memory database.
 * Each PrismaClient instance gets its own isolated schema and data.
 */
export function createUniqueTestDatabaseUrl(): string {
  return `file:flowforge-test-${randomUUID()}?mode=memory&cache=private`;
}
