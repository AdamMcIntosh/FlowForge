import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TYPE } from '../../domain/auth/auth-token-claims.js';
import { getEnv } from '../config.js';
import { createJwtService, JwtVerificationError } from './jwt-service.js';

function futureTokenDates(): { issuedAt: Date; expiresAt: Date } {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
  return { issuedAt, expiresAt };
}

describe('createJwtService', () => {
  let jwtService: ReturnType<typeof createJwtService>;
  let env: ReturnType<typeof getEnv>;

  beforeEach(() => {
    env = getEnv();
    jwtService = createJwtService(env);
  });

  describe('signAccessToken', () => {
    it('signs access tokens with RS256, normalized email, and a unique jti', () => {
      const { issuedAt, expiresAt } = futureTokenDates();

      const first = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'User@Example.com',
        issuedAt,
        expiresAt,
      });
      const second = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'User@Example.com',
        issuedAt,
        expiresAt,
      });

      expect(first.token).not.toBe(second.token);
      expect(first.claims.jti).not.toBe(second.claims.jti);
      expect(first.claims.email).toBe('user@example.com');
      expect(first.claims.type).toBe(ACCESS_TOKEN_TYPE);
      expect(jwtService.verifyAccessToken(first.token)).toEqual(first.claims);
    });

    it('preserves an explicitly supplied jti', () => {
      const { issuedAt, expiresAt } = futureTokenDates();

      const signed = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'user@example.com',
        jti: 'fixed-access-jti',
        issuedAt,
        expiresAt,
      });

      expect(signed.claims.jti).toBe('fixed-access-jti');
      expect(jwtService.verifyAccessToken(signed.token).jti).toBe('fixed-access-jti');
    });
  });

  describe('verifyAccessToken', () => {
    it('throws JwtVerificationError for malformed tokens', () => {
      expect(() => jwtService.verifyAccessToken('not-a-jwt')).toThrow(JwtVerificationError);
      expect(() => jwtService.verifyAccessToken('not-a-jwt')).toThrow(
        'Invalid or expired token',
      );
    });

    it('throws JwtVerificationError for expired access tokens', () => {
      const signed = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'user@example.com',
        issuedAt: new Date('2020-01-01T00:00:00.000Z'),
        expiresAt: new Date('2020-01-02T00:00:00.000Z'),
      });

      expect(() => jwtService.verifyAccessToken(signed.token)).toThrow(JwtVerificationError);
    });

    it('throws JwtVerificationError when required access claims are missing', () => {
      const { issuedAt: issuedAtDate, expiresAt: expiresAtDate } = futureTokenDates();
      const issuedAt = Math.floor(issuedAtDate.getTime() / 1000);
      const expiresAt = Math.floor(expiresAtDate.getTime() / 1000);

      const tokenMissingEmail = jwt.sign(
        {
          sub: 'user-1',
          jti: 'missing-email',
          type: ACCESS_TOKEN_TYPE,
          iat: issuedAt,
          exp: expiresAt,
        },
        env.JWT_PRIVATE_KEY,
        { algorithm: 'RS256' },
      );

      expect(() => jwtService.verifyAccessToken(tokenMissingEmail)).toThrow(
        JwtVerificationError,
      );
    });

    it('throws JwtVerificationError for a tampered access token', () => {
      const { issuedAt, expiresAt } = futureTokenDates();
      const signed = jwtService.signAccessToken({
        userId: 'user-1',
        email: 'user@example.com',
        issuedAt,
        expiresAt,
      });

      const tampered = `${signed.token}tampered`;

      expect(() => jwtService.verifyAccessToken(tampered)).toThrow(JwtVerificationError);
    });
  });

  describe('JwtVerificationError', () => {
    it('exposes a stable error name', () => {
      const error = new JwtVerificationError();

      expect(error.name).toBe('JwtVerificationError');
      expect(error.message).toBe('Invalid or expired token');
    });
  });
});
