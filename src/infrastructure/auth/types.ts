import type {
  AccessTokenClaims,
  CreateAccessTokenClaimsInput,
  CreateRefreshTokenClaimsInput,
  RefreshTokenClaims,
} from '../../domain/auth/auth-token-claims.js';
import type { Password } from '../../domain/auth/password.js';
import type { User, UserId } from '../../domain/auth/user.js';

export type SignedAccessToken = {
  token: string;
  claims: AccessTokenClaims;
};

export type SignAccessTokenInput = Omit<CreateAccessTokenClaimsInput, 'jti'> & {
  jti?: string;
};

export type SignedRefreshToken = {
  token: string;
  claims: RefreshTokenClaims;
};

export type SignRefreshTokenInput = Omit<CreateRefreshTokenClaimsInput, 'jti'> & {
  jti?: string;
};

export interface JwtService {
  signAccessToken(input: SignAccessTokenInput): SignedAccessToken;
  verifyAccessToken(token: string): AccessTokenClaims;
  signRefreshToken(input: SignRefreshTokenInput): SignedRefreshToken;
  verifyRefreshToken(token: string): RefreshTokenClaims;
}

export type RefreshTokenStatus = 'active' | 'rotated' | 'revoked';

export type RefreshTokenRecord = {
  jti: string;
  userId: string;
  family: string;
  status: RefreshTokenStatus;
  expiresAt: Date;
};

export interface RefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByJti(jti: string): Promise<RefreshTokenRecord | null>;
  updateStatus(jti: string, status: RefreshTokenStatus): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  isFamilyRevoked(family: string): boolean;
}

export interface PasswordHasher {
  hash(plaintext: string): Promise<Password>;
  verify(plaintext: string, password: Password): Promise<boolean>;
}

export type RateLimitAllowed = {
  allowed: true;
  remaining: number;
  resetAt: number;
};

export type RateLimitBlocked = {
  allowed: false;
  remaining: 0;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitResult = RateLimitAllowed | RateLimitBlocked;

export interface RateLimiter {
  check(key: string): RateLimitResult;
  checkMany(keys: readonly string[]): RateLimitResult;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<User>;
  existsByEmail(email: string): Promise<boolean>;
}

export type AuthInfrastructure = {
  jwtService: JwtService;
  passwordHasher: PasswordHasher;
  rateLimiter: RateLimiter;
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
};
