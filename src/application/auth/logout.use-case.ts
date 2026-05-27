import { InvalidRefreshTokenError } from '../../domain/index.js';
import { JwtVerificationError } from '../../infrastructure/auth/jwt-service.js';
import type { JwtService, RefreshTokenRepository } from '../../infrastructure/auth/types.js';
import type { LogoutInputDto } from './dto/index.js';

export type LogoutUseCaseDeps = {
  jwtService: JwtService;
  refreshTokenRepository: RefreshTokenRepository;
};

export function createLogoutUseCase(deps: LogoutUseCaseDeps) {
  return async function logout(input: LogoutInputDto): Promise<void> {
    let claims;

    try {
      claims = deps.jwtService.verifyRefreshToken(input.refreshToken);
    } catch (error: unknown) {
      if (error instanceof JwtVerificationError) {
        throw new InvalidRefreshTokenError();
      }

      throw error;
    }

    const record = await deps.refreshTokenRepository.findByJti(claims.jti);

    if (record === null) {
      throw new InvalidRefreshTokenError();
    }

    if (record.status === 'active') {
      await deps.refreshTokenRepository.updateStatus(claims.jti, 'revoked');
    }
  };
}
