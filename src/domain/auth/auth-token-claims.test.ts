import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,
  createAccessTokenClaims,
  createRefreshTokenClaims,
  isAccessTokenClaims,
  isRefreshTokenClaims,
} from './auth-token-claims.js';

describe('auth token claims', () => {
  const issuedAt = new Date('2025-05-27T12:00:00.000Z');
  const expiresAt = new Date('2025-05-27T13:00:00.000Z');

  it('creates access token claims with jti and normalized email', () => {
    const claims = createAccessTokenClaims({
      userId: 'user-1',
      email: '  User@Example.com ',
      jti: 'access-jti-1',
      issuedAt,
      expiresAt,
    });

    expect(claims).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      jti: 'access-jti-1',
      type: ACCESS_TOKEN_TYPE,
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    expect(isAccessTokenClaims(claims)).toBe(true);
    expect(isRefreshTokenClaims(claims)).toBe(false);
  });

  it('creates refresh token claims with family and jti', () => {
    const claims = createRefreshTokenClaims({
      userId: 'user-1',
      jti: 'refresh-jti-1',
      family: 'family-1',
      issuedAt,
      expiresAt,
    });

    expect(claims).toEqual({
      sub: 'user-1',
      jti: 'refresh-jti-1',
      family: 'family-1',
      type: REFRESH_TOKEN_TYPE,
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
    expect(isRefreshTokenClaims(claims)).toBe(true);
    expect(isAccessTokenClaims(claims)).toBe(false);
  });

  it('rejects empty jti values', () => {
    expect(() =>
      createAccessTokenClaims({
        userId: 'user-1',
        email: 'user@example.com',
        jti: '   ',
        issuedAt,
        expiresAt,
      }),
    ).toThrow('jti must be a non-empty string');
  });

  it('rejects expiry before issue time', () => {
    expect(() =>
      createRefreshTokenClaims({
        userId: 'user-1',
        jti: 'refresh-jti-1',
        family: 'family-1',
        issuedAt: expiresAt,
        expiresAt: issuedAt,
      }),
    ).toThrow('Token expiry must be after issue time');
  });

  it('rejects expiry equal to issue time', () => {
    const sameInstant = new Date('2025-05-27T12:00:00.000Z');

    expect(() =>
      createAccessTokenClaims({
        userId: 'user-1',
        email: 'user@example.com',
        jti: 'access-jti-1',
        issuedAt: sameInstant,
        expiresAt: sameInstant,
      }),
    ).toThrow('Token expiry must be after issue time');
  });

  it('rejects empty userId values', () => {
    expect(() =>
      createAccessTokenClaims({
        userId: '   ',
        email: 'user@example.com',
        jti: 'access-jti-1',
        issuedAt,
        expiresAt,
      }),
    ).toThrow('userId must be a non-empty string');
  });

  it('rejects empty email values', () => {
    expect(() =>
      createAccessTokenClaims({
        userId: 'user-1',
        email: '   ',
        jti: 'access-jti-1',
        issuedAt,
        expiresAt,
      }),
    ).toThrow('email must be a non-empty string');
  });

  it('rejects empty family values on refresh tokens', () => {
    expect(() =>
      createRefreshTokenClaims({
        userId: 'user-1',
        jti: 'refresh-jti-1',
        family: '   ',
        issuedAt,
        expiresAt,
      }),
    ).toThrow('family must be a non-empty string');
  });

  it('distinguishes access and refresh claims via type guards', () => {
    const accessClaims = createAccessTokenClaims({
      userId: 'user-1',
      email: 'user@example.com',
      jti: 'access-jti-1',
      issuedAt,
      expiresAt,
    });
    const refreshClaims = createRefreshTokenClaims({
      userId: 'user-1',
      jti: 'refresh-jti-1',
      family: 'family-1',
      issuedAt,
      expiresAt,
    });

    expect(isAccessTokenClaims(accessClaims)).toBe(true);
    expect(isRefreshTokenClaims(accessClaims)).toBe(false);
    expect(isAccessTokenClaims(refreshClaims)).toBe(false);
    expect(isRefreshTokenClaims(refreshClaims)).toBe(true);
  });
});
