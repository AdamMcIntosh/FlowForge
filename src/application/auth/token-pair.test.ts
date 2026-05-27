import { beforeEach, describe, expect, it, vi } from 'vitest';

import { User } from '../../domain/auth/user.js';
import { Password } from '../../domain/auth/password.js';
import type { JwtService, RefreshTokenRepository } from '../../infrastructure/auth/types.js';
import { issueTokenPair, toAuthUser } from './token-pair.js';

const TOKEN_SETTINGS = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604_800,
};

const TEST_USER = User.create({
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  passwordHash: Password.fromHash('hash'),
});

describe('issueTokenPair', () => {
  let jwtService: JwtService;
  let refreshTokenRepository: RefreshTokenRepository;

  beforeEach(() => {
    jwtService = {
      signAccessToken: vi.fn().mockReturnValue({
        token: 'access-token',
        claims: {
          sub: 'user-1',
          email: 'user@example.com',
          jti: 'access-jti-1',
          type: 'access' as const,
          iat: 1,
          exp: 2,
        },
      }),
      verifyAccessToken: vi.fn(),
      signRefreshToken: vi.fn().mockReturnValue({
        token: 'refresh-token',
        claims: {
          sub: 'user-1',
          jti: 'refresh-jti-1',
          family: 'family-1',
          type: 'refresh' as const,
          iat: 1,
          exp: 2,
        },
      }),
      verifyRefreshToken: vi.fn(),
    };

    refreshTokenRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findByJti: vi.fn(),
      updateStatus: vi.fn(),
      revokeFamily: vi.fn(),
      isFamilyRevoked: vi.fn().mockReturnValue(false),
    };
  });

  it('signs access and refresh tokens and persists the refresh record', async () => {
    const result = await issueTokenPair(
      { jwtService, refreshTokenRepository, tokenSettings: TOKEN_SETTINGS },
      TEST_USER,
    );

    expect(jwtService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        email: 'user@example.com',
      }),
    );
    expect(jwtService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        family: expect.any(String),
      }),
    );
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: 'refresh-jti-1',
        userId: 'user-1',
        status: 'active',
      }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });
  });

  it('reuses the provided token family when rotating', async () => {
    await issueTokenPair(
      { jwtService, refreshTokenRepository, tokenSettings: TOKEN_SETTINGS },
      TEST_USER,
      'existing-family',
    );

    expect(jwtService.signRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'existing-family',
      }),
    );
  });
});

describe('toAuthUser', () => {
  it('maps domain user fields to the auth response shape', () => {
    expect(toAuthUser(TEST_USER)).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
  });
});
