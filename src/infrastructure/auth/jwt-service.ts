import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import {
  ACCESS_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,
  createAccessTokenClaims,
  createRefreshTokenClaims,
  isAccessTokenClaims,
  isRefreshTokenClaims,
} from '../../domain/auth/auth-token-claims.js';
import type { Env } from '../config.js';
import type {
  JwtService,
  SignAccessTokenInput,
  SignRefreshTokenInput,
  SignedAccessToken,
} from './types.js';

export class JwtVerificationError extends Error {
  constructor(message = 'Invalid or expired token') {
    super(message);
    this.name = 'JwtVerificationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringClaim(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumberClaim(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
}

function parseVerifiedPayload(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new JwtVerificationError();
  }

  return payload;
}

export function createJwtService(env: Env): JwtService {
  const privateKey = env.JWT_PRIVATE_KEY;
  const publicKey = env.JWT_PUBLIC_KEY;

  return {
    signAccessToken(input: SignAccessTokenInput): SignedAccessToken {
      const jti = input.jti ?? randomUUID();
      const claims = createAccessTokenClaims({ ...input, jti });
      const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });

      return { token, claims };
    },

    verifyAccessToken(token: string): ReturnType<JwtService['verifyAccessToken']> {
      let payload: Record<string, unknown>;

      try {
        payload = parseVerifiedPayload(
          jwt.verify(token, publicKey, { algorithms: ['RS256'] }),
        );
      } catch {
        throw new JwtVerificationError();
      }

      const sub = readStringClaim(payload, 'sub');
      const email = readStringClaim(payload, 'email');
      const jti = readStringClaim(payload, 'jti');
      const type = readStringClaim(payload, 'type');
      const iat = readNumberClaim(payload, 'iat');
      const exp = readNumberClaim(payload, 'exp');

      if (
        sub === undefined ||
        email === undefined ||
        jti === undefined ||
        type !== ACCESS_TOKEN_TYPE ||
        iat === undefined ||
        exp === undefined
      ) {
        throw new JwtVerificationError();
      }

      const claims = createAccessTokenClaims({
        userId: sub,
        email,
        jti,
        issuedAt: new Date(iat * 1000),
        expiresAt: new Date(exp * 1000),
      });

      if (!isAccessTokenClaims(claims)) {
        throw new JwtVerificationError();
      }

      return claims;
    },

    signRefreshToken(input: SignRefreshTokenInput): ReturnType<JwtService['signRefreshToken']> {
      const jti = input.jti ?? randomUUID();
      const claims = createRefreshTokenClaims({ ...input, jti });
      const token = jwt.sign(claims, privateKey, { algorithm: 'RS256' });

      return { token, claims };
    },

    verifyRefreshToken(token: string): ReturnType<JwtService['verifyRefreshToken']> {
      let payload: Record<string, unknown>;

      try {
        payload = parseVerifiedPayload(
          jwt.verify(token, publicKey, { algorithms: ['RS256'] }),
        );
      } catch {
        throw new JwtVerificationError();
      }

      const sub = readStringClaim(payload, 'sub');
      const jti = readStringClaim(payload, 'jti');
      const family = readStringClaim(payload, 'family');
      const type = readStringClaim(payload, 'type');
      const iat = readNumberClaim(payload, 'iat');
      const exp = readNumberClaim(payload, 'exp');

      if (
        sub === undefined ||
        jti === undefined ||
        family === undefined ||
        type !== REFRESH_TOKEN_TYPE ||
        iat === undefined ||
        exp === undefined
      ) {
        throw new JwtVerificationError();
      }

      const claims = createRefreshTokenClaims({
        userId: sub,
        jti,
        family,
        issuedAt: new Date(iat * 1000),
        expiresAt: new Date(exp * 1000),
      });

      if (!isRefreshTokenClaims(claims)) {
        throw new JwtVerificationError();
      }

      return claims;
    },
  };
}
