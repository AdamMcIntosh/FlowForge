export const ACCESS_TOKEN_TYPE = 'access' as const;
export const REFRESH_TOKEN_TYPE = 'refresh' as const;

export type TokenType = typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE;

export type AccessTokenClaims = {
  readonly sub: string;
  readonly email: string;
  readonly jti: string;
  readonly type: typeof ACCESS_TOKEN_TYPE;
  readonly iat: number;
  readonly exp: number;
};

export type RefreshTokenClaims = {
  readonly sub: string;
  readonly jti: string;
  readonly family: string;
  readonly type: typeof REFRESH_TOKEN_TYPE;
  readonly iat: number;
  readonly exp: number;
};

export type AuthTokenClaims = AccessTokenClaims | RefreshTokenClaims;

export type CreateAccessTokenClaimsInput = {
  userId: string;
  email: string;
  jti: string;
  issuedAt: Date;
  expiresAt: Date;
};

export type CreateRefreshTokenClaimsInput = {
  userId: string;
  jti: string;
  family: string;
  issuedAt: Date;
  expiresAt: Date;
};

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function assertValidExpiry(issuedAt: Date, expiresAt: Date): void {
  if (expiresAt.getTime() <= issuedAt.getTime()) {
    throw new Error('Token expiry must be after issue time');
  }
}

export function createAccessTokenClaims(
  input: CreateAccessTokenClaimsInput,
): AccessTokenClaims {
  assertNonEmpty(input.userId, 'userId');
  assertNonEmpty(input.email, 'email');
  assertNonEmpty(input.jti, 'jti');
  assertValidExpiry(input.issuedAt, input.expiresAt);

  return {
    sub: input.userId,
    email: input.email.trim().toLowerCase(),
    jti: input.jti,
    type: ACCESS_TOKEN_TYPE,
    iat: toUnixSeconds(input.issuedAt),
    exp: toUnixSeconds(input.expiresAt),
  };
}

export function createRefreshTokenClaims(
  input: CreateRefreshTokenClaimsInput,
): RefreshTokenClaims {
  assertNonEmpty(input.userId, 'userId');
  assertNonEmpty(input.jti, 'jti');
  assertNonEmpty(input.family, 'family');
  assertValidExpiry(input.issuedAt, input.expiresAt);

  return {
    sub: input.userId,
    jti: input.jti,
    family: input.family,
    type: REFRESH_TOKEN_TYPE,
    iat: toUnixSeconds(input.issuedAt),
    exp: toUnixSeconds(input.expiresAt),
  };
}

export function isAccessTokenClaims(claims: AuthTokenClaims): claims is AccessTokenClaims {
  return claims.type === ACCESS_TOKEN_TYPE;
}

export function isRefreshTokenClaims(claims: AuthTokenClaims): claims is RefreshTokenClaims {
  return claims.type === REFRESH_TOKEN_TYPE;
}
