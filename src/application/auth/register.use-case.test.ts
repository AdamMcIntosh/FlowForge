import { describe, expect, it, vi } from 'vitest';

import {
  InvalidEmailError,
  InvalidNameError,
  InvalidPasswordError,
  UserAlreadyExistsError,
} from '../../domain/index.js';
import type { User } from '../../domain/index.js';
import { getEnv } from '../../infrastructure/config.js';
import { createArgon2PasswordHasher } from '../../infrastructure/auth/password-hasher.js';
import { createJwtService } from '../../infrastructure/auth/jwt-service.js';
import { createInMemoryRefreshTokenRepository } from '../../infrastructure/auth/refresh-token-repository.js';
import type { UserRepository } from '../../infrastructure/auth/types.js';
import { createRegisterUseCase } from './register.use-case.js';

function createTestDeps(overrides?: {
  userRepository?: Partial<UserRepository>;
}) {
  const userRepository: UserRepository = {
    existsByEmail: vi.fn().mockResolvedValue(false),
    save: vi.fn(async (user: User) => user),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    ...overrides?.userRepository,
  };

  return {
    jwtService: createJwtService(getEnv()),
    passwordHasher: createArgon2PasswordHasher(),
    refreshTokenRepository: createInMemoryRefreshTokenRepository(),
    userRepository,
    tokenSettings: {
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 604_800,
    },
  };
}

describe('createRegisterUseCase', () => {
  it('creates a user and returns an access token with unique jti', async () => {
    const deps = createTestDeps();
    const register = createRegisterUseCase(deps);

    const result = await register({
      email: 'User@Example.com',
      name: '  Test User  ',
      password: 'Password1',
    });

    expect(result.user).toEqual({
      id: expect.any(String),
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
    expect(result.tokens.expiresIn).toBe(900);
    expect(deps.userRepository.existsByEmail).toHaveBeenCalledWith('User@Example.com');
    expect(deps.userRepository.save).toHaveBeenCalledTimes(1);

    const claims = deps.jwtService.verifyAccessToken(result.tokens.accessToken);
    expect(claims.sub).toBe(result.user.id);
    expect(claims.jti).toEqual(expect.any(String));
  });

  it('throws UserAlreadyExistsError when the email is already registered', async () => {
    const deps = createTestDeps({
      userRepository: {
        existsByEmail: vi.fn().mockResolvedValue(true),
      },
    });
    const register = createRegisterUseCase(deps);

    await expect(
      register({
        email: 'taken@example.com',
        name: 'Test User',
        password: 'Password1',
      }),
    ).rejects.toThrow(UserAlreadyExistsError);

    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('throws InvalidPasswordError when the password does not meet domain policy', async () => {
    const deps = createTestDeps();
    const register = createRegisterUseCase(deps);

    await expect(
      register({
        email: 'new@example.com',
        name: 'Test User',
        password: 'short1',
      }),
    ).rejects.toThrow(InvalidPasswordError);

    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('throws InvalidEmailError when domain email validation fails', async () => {
    const hash = vi.fn();
    const deps = createTestDeps();
    deps.passwordHasher = { hash, verify: vi.fn() };
    const register = createRegisterUseCase(deps);

    await expect(
      register({
        email: 'user@localhost',
        name: 'Test User',
        password: 'Password1',
      }),
    ).rejects.toThrow(InvalidEmailError);

    expect(deps.userRepository.save).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('throws InvalidNameError when domain name validation fails', async () => {
    const deps = createTestDeps();
    const register = createRegisterUseCase(deps);

    await expect(
      register({
        email: 'new@example.com',
        name: 'a'.repeat(256),
        password: 'Password1',
      }),
    ).rejects.toThrow(new InvalidNameError('Name must be at most 255 characters'));

    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('hashes the plaintext password before persisting the user', async () => {
    const hash = vi.fn().mockImplementation(async (plaintext: string) => {
      const { Password: PasswordValueObject } = await import('../../domain/auth/password.js');
      return PasswordValueObject.fromHash(`hashed:${plaintext}`);
    });
    const deps = createTestDeps();
    deps.passwordHasher = { hash, verify: vi.fn() };
    const register = createRegisterUseCase(deps);

    await register({
      email: 'new@example.com',
      name: 'Test User',
      password: 'Password1',
    });

    expect(hash).toHaveBeenCalledWith('Password1');
    const savedUser = vi.mocked(deps.userRepository.save).mock.calls[0]?.[0];
    expect(savedUser?.password.getHash()).toBe('hashed:Password1');
  });

  it('throws UserAlreadyExistsError with AUTH_USER_ALREADY_EXISTS code', async () => {
    const deps = createTestDeps({
      userRepository: {
        existsByEmail: vi.fn().mockResolvedValue(true),
      },
    });
    const register = createRegisterUseCase(deps);

    let error: UserAlreadyExistsError | undefined;

    try {
      await register({
        email: 'taken@example.com',
        name: 'Test User',
        password: 'Password1',
      });
    } catch (caught) {
      error = caught as UserAlreadyExistsError;
    }

    expect(error?.code).toBe('AUTH_USER_ALREADY_EXISTS');
  });

  it('persists the user with normalized email and name', async () => {
    const deps = createTestDeps();
    const register = createRegisterUseCase(deps);

    await register({
      email: '  User@Example.com  ',
      name: '  Test User  ',
      password: 'Password1',
    });

    const savedUser = vi.mocked(deps.userRepository.save).mock.calls[0]?.[0];
    expect(savedUser?.email).toBe('user@example.com');
    expect(savedUser?.name).toBe('Test User');
  });

  it('checks email existence before validating the password', async () => {
    const existsByEmail = vi.fn().mockResolvedValue(true);
    const hash = vi.fn();
    const deps = createTestDeps({
      userRepository: { existsByEmail },
    });
    deps.passwordHasher = { hash, verify: vi.fn() };
    const register = createRegisterUseCase(deps);

    await expect(
      register({
        email: 'taken@example.com',
        name: 'Test User',
        password: 'short1',
      }),
    ).rejects.toThrow(UserAlreadyExistsError);

    expect(existsByEmail).toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});
