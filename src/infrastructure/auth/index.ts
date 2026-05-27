export { createAuthInfrastructure } from './create-auth-infrastructure.js';
export {
  createJwtAuthMiddleware,
  extractBearerToken,
  sendJwtUnauthorized,
  type CreateJwtAuthMiddlewareOptions,
  type JwtAuthMiddleware,
} from './jwt-auth-middleware.js';
export { JwtVerificationError, createJwtService } from './jwt-service.js';
export { createArgon2PasswordHasher } from './password-hasher.js';
export {
  buildIpRateLimitKey,
  buildUserRateLimitKey,
  createFixedWindowRateLimiter,
  createNoOpRateLimiter,
  getClientIp,
  getUserIdFromAuthorizationHeader,
  registerEarlyRateLimit,
  resolveAuthRateLimitKeys,
  sendRateLimitExceeded,
  type EarlyRateLimitOptions,
} from './rate-limiter.js';
export { createInMemoryRefreshTokenRepository } from './refresh-token-repository.js';
export type {
  AuthInfrastructure,
  JwtService,
  PasswordHasher,
  RateLimitAllowed,
  RateLimitBlocked,
  RateLimitResult,
  RateLimiter,
  RefreshTokenRecord,
  RefreshTokenRepository,
  RefreshTokenStatus,
  SignAccessTokenInput,
  SignRefreshTokenInput,
  SignedAccessToken,
  SignedRefreshToken,
  UserRepository,
} from './types.js';
export { createPrismaUserRepository } from './user-repository.js';
