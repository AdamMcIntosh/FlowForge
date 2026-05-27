import { PrismaClient } from '@prisma/client';

import type { Env } from './config.js';

export interface Database {
  prisma: PrismaClient;
  connectDatabase: () => Promise<void>;
  disconnectDatabase: () => Promise<void>;
}

export function createDatabase(env: Env): Database {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return {
    prisma,
    async connectDatabase(): Promise<void> {
      await prisma.$connect();
    },
    async disconnectDatabase(): Promise<void> {
      await prisma.$disconnect();
    },
  };
}
