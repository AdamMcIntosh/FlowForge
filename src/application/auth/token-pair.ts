import { randomUUID } from 'node:crypto';

import type { User } from '../../domain/index.js';
import type { JwtService, RefreshTokenRepository } from '../../infrastructure/auth/types.js';
import type { AuthTokensDto } from './dto/index.js';
import type { AuthTokenSettings } from './types.js';

export type IssueTokenPairDeps = {
  jwtService: JwtService;
  refreshTokenRepository: RefreshTokenRepository;
  tokenSettings: AuthTokenSettings;
};

export async function issueTokenPair(
  deps: IssueTokenPairDeps,
  user: User,
  family?: string,
): Promise<AuthTokensDto> {
  const now = new Date();
  const accessExpiresAt = new Date(
    now.getTime() + deps.tokenSettings.accessTokenTtlSeconds * 1000,
  );
  const refreshExpiresAt = new Date(
    now.getTime() + deps.tokenSettings.refreshTokenTtlSeconds * 1000,
  );
  const tokenFamily = family ?? randomUUID();

  const access = deps.jwtService.signAccessToken({
    userId: user.id,
    email: user.email,
    issuedAt: now,
    expiresAt: accessExpiresAt,
  });

  const refresh = deps.jwtService.signRefreshToken({
    userId: user.id,
    family: tokenFamily,
    issuedAt: now,
    expiresAt: refreshExpiresAt,
  });

  await deps.refreshTokenRepository.save({
    jti: refresh.claims.jti,
    userId: user.id,
    family: tokenFamily,
    status: 'active',
    expiresAt: refreshExpiresAt,
  });

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    expiresIn: deps.tokenSettings.accessTokenTtlSeconds,
  };
}

export function toAuthUser(user: User): { id: string; email: string; name: string } {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
