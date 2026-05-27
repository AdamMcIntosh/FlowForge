import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { InvalidRefreshTokenError, Password, User } from '../../domain/index.js';
import { createArgon2PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { createJwtService } from '../../infrastructure/auth/jwt-service.js';
import { createInMemoryRefreshTokenRepository } from '../../infrastructure/auth/refresh-token-repository.js';
import type { UserRepository } from '../../infrastructure/auth/types.js';
import { getEnv } from '../../infrastructure/config.js';
import {
  createAuthUseCases,
  createAuthUseCasesFromInfrastructure,
} from './create-auth-use-cases.js';

const tokenSettings = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604_800,
};

function createTestUser(): User {
  return User.reconstitute({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    password: Password.fromHash('$argon2id$v=19$m=65536,t=3,p=4$hash'),
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  });
}

function createTestAuthUseCases(user: User) {
  const jwtService = createJwtService(getEnv());
  const userRepository: UserRepository = {
    findById: async (id) => (id === user.id ? user : null),
    findByEmail: async () => null,
    save: async (savedUser) => savedUser,
    existsByEmail: async () => false,
  };

  const deps = {
    jwtService,
    userRepository,
    refreshTokenRepository: createInMemoryRefreshTokenRepository(),
    passwordHasher: {
      hash: async () => Password.fromHash('hash'),
      verify: async () => false,
    },
    tokenSettings,
  };

  return {
    authUseCases: createAuthUseCases(deps),
    jwtService,
    deps,
  };
}

describe('createAuthUseCases', () => {
  describe('register', () => {
    it('parses valid input with Zod before invoking the use case', async () => {
      const jwtService = createJwtService(getEnv());
      const passwordHasher = createArgon2PasswordHasher();
      const userRepository: UserRepository = {
        existsByEmail: async () => false,
        save: async (user) => user,
        findByEmail: async () => null,
        findById: async () => null,
      };

      const authUseCases = createAuthUseCases({
        jwtService,
        userRepository,
        passwordHasher,
        refreshTokenRepository: createInMemoryRefreshTokenRepository(),
        tokenSettings,
      });

      const result = await authUseCases.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'Password1',
      });

      expect(result.user.email).toBe('new@example.com');
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(result.tokens.expiresIn).toBe(900);
    });

    it('rejects invalid register input at the Zod boundary', async () => {
      const { authUseCases } = createTestAuthUseCases(createTestUser());

      await expect(
        authUseCases.register({
          email: 'bad-email',
          name: 'User',
          password: 'Password1',
        }),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('login', () => {
    it('rejects invalid login input at the Zod boundary', async () => {
      const { authUseCases } = createTestAuthUseCases(createTestUser());

      await expect(
        authUseCases.login({
          email: 'user@example.com',
        }),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  describe('logout', () => {
    it('revokes an active refresh token and is idempotent when already revoked', async () => {
      const jwtService = createJwtService(getEnv());
      const refreshTokenRepository = createInMemoryRefreshTokenRepository();
      const user = createTestUser();
      const now = new Date();
      const refresh = jwtService.signRefreshToken({
        userId: user.id,
        family: 'family-1',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      });

      await refreshTokenRepository.save({
        jti: refresh.claims.jti,
        userId: user.id,
        family: 'family-1',
        status: 'active',
        expiresAt: new Date(now.getTime() + 60_000),
      });

      const authUseCases = createAuthUseCases({
        jwtService,
        refreshTokenRepository,
        passwordHasher: createArgon2PasswordHasher(),
        userRepository: {
          findById: async () => user,
          findByEmail: async () => null,
          save: async (savedUser) => savedUser,
          existsByEmail: async () => false,
        },
        tokenSettings,
      });

      await expect(authUseCases.logout({ refreshToken: refresh.token })).resolves.toBeUndefined();
      await expect(authUseCases.logout({ refreshToken: refresh.token })).resolves.toBeUndefined();

      const record = await refreshTokenRepository.findByJti(refresh.claims.jti);
      expect(record?.status).toBe('revoked');
    });

    it('rejects invalid refresh tokens at logout', async () => {
      const { authUseCases } = createTestAuthUseCases(createTestUser());

      await expect(authUseCases.logout({ refreshToken: 'not-a-jwt' })).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });
  });

  describe('refresh', () => {
    it('rotates refresh tokens and issues access tokens with unique jti values', async () => {
      const jwtService = createJwtService(getEnv());
      const refreshTokenRepository = createInMemoryRefreshTokenRepository();
      const user = createTestUser();
      const now = new Date();
      const refresh = jwtService.signRefreshToken({
        userId: user.id,
        family: 'family-1',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      });

      await refreshTokenRepository.save({
        jti: refresh.claims.jti,
        userId: user.id,
        family: 'family-1',
        status: 'active',
        expiresAt: new Date(now.getTime() + 60_000),
      });

      const authUseCases = createAuthUseCases({
        jwtService,
        refreshTokenRepository,
        passwordHasher: createArgon2PasswordHasher(),
        userRepository: {
          findById: async () => user,
          findByEmail: async () => null,
          save: async (savedUser) => savedUser,
          existsByEmail: async () => false,
        },
        tokenSettings,
      });

      const first = await authUseCases.refresh({ refreshToken: refresh.token });
      const second = await authUseCases.refresh({ refreshToken: first.refreshToken });

      const firstClaims = jwtService.verifyAccessToken(first.accessToken);
      const secondClaims = jwtService.verifyAccessToken(second.accessToken);
      expect(firstClaims.jti).not.toBe(secondClaims.jti);
    });

    it('revokes the token family when a rotated refresh token is replayed', async () => {
      const jwtService = createJwtService(getEnv());
      const refreshTokenRepository = createInMemoryRefreshTokenRepository();
      const user = createTestUser();
      const now = new Date();
      const refresh = jwtService.signRefreshToken({
        userId: user.id,
        family: 'family-1',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      });

      await refreshTokenRepository.save({
        jti: refresh.claims.jti,
        userId: user.id,
        family: 'family-1',
        status: 'active',
        expiresAt: new Date(now.getTime() + 60_000),
      });

      const authUseCases = createAuthUseCases({
        jwtService,
        refreshTokenRepository,
        passwordHasher: createArgon2PasswordHasher(),
        userRepository: {
          findById: async () => user,
          findByEmail: async () => null,
          save: async (savedUser) => savedUser,
          existsByEmail: async () => false,
        },
        tokenSettings,
      });

      await authUseCases.refresh({ refreshToken: refresh.token });

      await expect(authUseCases.refresh({ refreshToken: refresh.token })).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(refreshTokenRepository.isFamilyRevoked('family-1')).toBe(true);
    });
  });
});

describe('createAuthUseCasesFromInfrastructure', () => {
  it('wires infrastructure dependencies into parsed use case facades', async () => {
    const jwtService = createJwtService(getEnv());
    const passwordHasher = createArgon2PasswordHasher();

    const authUseCases = createAuthUseCasesFromInfrastructure(
      {
        jwtService,
        passwordHasher,
        refreshTokenRepository: createInMemoryRefreshTokenRepository(),
        userRepository: {
          existsByEmail: async () => false,
          save: async (user) => user,
          findByEmail: async () => null,
          findById: async () => null,
        },
      },
      tokenSettings,
    );

    const result = await authUseCases.register({
      email: 'factory@example.com',
      name: 'Factory User',
      password: 'Password1',
    });

    expect(result.user.email).toBe('factory@example.com');
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));

    const claims = jwtService.verifyAccessToken(result.tokens.accessToken);
    expect(claims.jti).toEqual(expect.any(String));
  });
});
