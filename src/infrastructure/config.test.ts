import { afterEach, describe, expect, it } from 'vitest';

import { getEnv, resetEnvCache } from './config.js';

describe('getEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  const testPrivateKey =
    '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCfAHRvLxFYcls4\\n-----END PRIVATE KEY-----';
  const testPublicKey =
    '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnwB0by8RWHJbOGICa1gM\\n-----END PUBLIC KEY-----';

  it('parses DATABASE_URL, NODE_ENV, and PORT from process.env', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = '1800';
    process.env.JWT_REFRESH_TOKEN_TTL_SECONDS = '86400';
    process.env.RATE_LIMIT_WINDOW_MS = '30000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '5';
    resetEnvCache();

    expect(getEnv()).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NODE_ENV: 'test',
      PORT: 4000,
      JWT_PRIVATE_KEY: testPrivateKey.replace(/\\n/g, '\n'),
      JWT_PUBLIC_KEY: testPublicKey.replace(/\\n/g, '\n'),
      JWT_ACCESS_TOKEN_TTL_SECONDS: 1800,
      JWT_REFRESH_TOKEN_TTL_SECONDS: 86400,
      RATE_LIMIT_WINDOW_MS: 30000,
      RATE_LIMIT_MAX_REQUESTS: 5,
    });
  });

  it('applies defaults for NODE_ENV and PORT', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.JWT_ACCESS_TOKEN_TTL_SECONDS;
    delete process.env.JWT_REFRESH_TOKEN_TTL_SECONDS;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    resetEnvCache();

    expect(getEnv()).toEqual({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NODE_ENV: 'development',
      PORT: 3000,
      JWT_PRIVATE_KEY: testPrivateKey.replace(/\\n/g, '\n'),
      JWT_PUBLIC_KEY: testPublicKey.replace(/\\n/g, '\n'),
      JWT_ACCESS_TOKEN_TTL_SECONDS: 900,
      JWT_REFRESH_TOKEN_TTL_SECONDS: 604800,
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 10,
    });
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    resetEnvCache();

    expect(() => getEnv()).toThrow();
  });

  it('throws when NODE_ENV is invalid', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_PRIVATE_KEY = testPrivateKey;
    process.env.JWT_PUBLIC_KEY = testPublicKey;
    process.env.NODE_ENV = 'staging';
    resetEnvCache();

    expect(() => getEnv()).toThrow();
  });
});
