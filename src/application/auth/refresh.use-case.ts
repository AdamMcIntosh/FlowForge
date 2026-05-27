import { InvalidRefreshTokenError } from '../../domain/index.js';
import { JwtVerificationError } from '../../infrastructure/auth/jwt-service.js';
import type { JwtService, RefreshTokenRepository, UserRepository } from '../../infrastructure/auth/types.js';
import type { RefreshInputDto, RefreshResultDto } from './dto/index.js';
import { issueTokenPair, type IssueTokenPairDeps } from './token-pair.js';

export type RefreshUseCaseDeps = IssueTokenPairDeps & {
  jwtService: JwtService;
  refreshTokenRepository: RefreshTokenRepository;
  userRepository: UserRepository;
};

export function createRefreshUseCase(deps: RefreshUseCaseDeps) {
  return async function refresh(input: RefreshInputDto): Promise<RefreshResultDto> {
    let claims;

    try {
      claims = deps.jwtService.verifyRefreshToken(input.refreshToken);
    } catch (error: unknown) {
      if (error instanceof JwtVerificationError) {
        throw new InvalidRefreshTokenError();
      }

      throw error;
    }

    if (deps.refreshTokenRepository.isFamilyRevoked(claims.family)) {
      throw new InvalidRefreshTokenError();
    }

    const record = await deps.refreshTokenRepository.findByJti(claims.jti);

    if (record === null) {
      throw new InvalidRefreshTokenError();
    }

    if (record.status === 'revoked') {
      throw new InvalidRefreshTokenError();
    }

    if (record.status === 'rotated') {
      await deps.refreshTokenRepository.revokeFamily(claims.family);
      throw new InvalidRefreshTokenError();
    }

    const user = await deps.userRepository.findById(claims.sub);

    if (user === null) {
      throw new InvalidRefreshTokenError();
    }

    await deps.refreshTokenRepository.updateStatus(claims.jti, 'rotated');

    const tokens = await issueTokenPair(deps, user, claims.family);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  };
}
