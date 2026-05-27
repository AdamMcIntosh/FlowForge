import { describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../../domain/index.js';
import { Password } from '../../domain/auth/password.js';
import { User } from '../../domain/auth/user.js';
import { getEnv } from '../../infrastructure/config.js';
import { createArgon2PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { createJwtService } from '../../infrastructure/auth/jwt-service.js';
import { createInMemoryRefreshTokenRepository } from '../../infrastructure/auth/refresh-token-repository.js';
import type { UserRepository } from '../../infrastructure/auth/types.js';
import { createLoginUseCase } from './login.use-case.js';

const TEST_PASSWORD_HASH = Password.fromHash('$argon2id$v=19$m=65536,t=3,p=4$hash');

function createTestUser(): User {
  return User.create({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
    passwordHash: TEST_PASSWORD_HASH,
  });
}

function createTestDeps(overrides?: {
  userRepository?: Partial<UserRepository>;
  passwordMatches?: boolean;
  testUser?: User;
}) {
  const testUser = overrides?.testUser ?? createTestUser();

  const passwordHasher = createArgon2PasswordHasher();
  const verify = vi.fn().mockResolvedValue(overrides?.passwordMatches ?? true);

  const userRepository: UserRepository = {
    findByEmail: vi.fn().mockResolvedValue(testUser),
    findById: vi.fn(),
    save: vi.fn(),
    existsByEmail: vi.fn(),
    ...overrides?.userRepository,
  };

  return {
    jwtService: createJwtService(getEnv()),
    passwordHasher: {
      hash: passwordHasher.hash.bind(passwordHasher),
      verify,
    },
    refreshTokenRepository: createInMemoryRefreshTokenRepository(),
    userRepository,
    tokenSettings: {
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604_800,
    },
    verify,
    testUser,
  };
}

describe('createLoginUseCase', () => {
  it('returns user profile and access token for valid credentials', async () => {
    const deps = createTestDeps();
    const login = createLoginUseCase(deps);

    const result = await login({
      email: 'user@example.com',
      password: 'Password1',
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
    expect(result.tokens.expiresIn).toBe(900);
    expect(deps.verify).toHaveBeenCalledWith('Password1', deps.testUser.password);

    const claims = deps.jwtService.verifyAccessToken(result.tokens.accessToken);
    expect(claims.sub).toBe('user-1');
    expect(claims.jti).toEqual(expect.any(String));
  });

  it('throws InvalidCredentialsError when the user does not exist', async () => {
    const deps = createTestDeps({
      userRepository: {
        findByEmail: vi.fn().mockResolvedValue(null),
      },
    });
    const login = createLoginUseCase(deps);

    await expect(
      login({
        email: 'missing@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(deps.verify).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsError when the password is wrong', async () => {
    const deps = createTestDeps({ passwordMatches: false });
    const login = createLoginUseCase(deps);

    await expect(
      login({
        email: 'user@example.com',
        password: 'WrongPassword1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('uses the same error code and message for missing user and wrong password', async () => {
    let missingUserError: InvalidCredentialsError | undefined;
    let wrongPasswordError: InvalidCredentialsError | undefined;

    const missingUserDeps = createTestDeps({
      userRepository: {
        findByEmail: vi.fn().mockResolvedValue(null),
      },
    });

    try {
      await createLoginUseCase(missingUserDeps)({
        email: 'missing@example.com',
        password: 'Password1',
      });
    } catch (error) {
      missingUserError = error as InvalidCredentialsError;
    }

    const wrongPasswordDeps = createTestDeps({ passwordMatches: false });

    try {
      await createLoginUseCase(wrongPasswordDeps)({
        email: 'user@example.com',
        password: 'WrongPassword1',
      });
    } catch (error) {
      wrongPasswordError = error as InvalidCredentialsError;
    }

    expect(missingUserError?.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(wrongPasswordError?.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(missingUserError?.message).toBe(wrongPasswordError?.message);
  });

  it('does not persist a user or check email existence during login', async () => {
    const deps = createTestDeps();
    const login = createLoginUseCase(deps);

    await login({
      email: 'user@example.com',
      password: 'Password1',
    });

    expect(deps.userRepository.existsByEmail).not.toHaveBeenCalled();
    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('looks up the user by the submitted email before verifying the password', async () => {
    const findByEmail = vi.fn().mockResolvedValue(null);
    const deps = createTestDeps({
      userRepository: { findByEmail },
    });
    const login = createLoginUseCase(deps);

    await expect(
      login({
        email: 'missing@example.com',
        password: 'Password1',
      }),
    ).rejects.toThrow(InvalidCredentialsError);

    expect(findByEmail).toHaveBeenCalledWith('missing@example.com');
  });
});
