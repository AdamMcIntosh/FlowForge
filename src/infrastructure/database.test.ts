import { afterEach, describe, expect, it } from 'vitest';

import { getEnv, resetEnvCache } from './config.js';
import { createDatabase } from './database.js';

describe('createDatabase', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('returns prisma client and connect/disconnect helpers', () => {
    const database = createDatabase(getEnv());

    expect(database.prisma).toBeDefined();
    expect(typeof database.prisma.$connect).toBe('function');
    expect(typeof database.connectDatabase).toBe('function');
    expect(typeof database.disconnectDatabase).toBe('function');
  });
});
