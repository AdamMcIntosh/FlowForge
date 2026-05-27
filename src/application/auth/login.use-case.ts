import { InvalidCredentialsError } from '../../domain/index.js';
import type { PasswordHasher, UserRepository } from '../../infrastructure/auth/types.js';
import type { AuthResultDto, LoginInputDto } from './dto/index.js';
import { issueTokenPair, toAuthUser, type IssueTokenPairDeps } from './token-pair.js';

export type LoginUseCaseDeps = IssueTokenPairDeps & {
  passwordHasher: PasswordHasher;
  userRepository: UserRepository;
};

export function createLoginUseCase(deps: LoginUseCaseDeps) {
  return async function login(input: LoginInputDto): Promise<AuthResultDto> {
    const user = await deps.userRepository.findByEmail(input.email);

    if (user === null) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await deps.passwordHasher.verify(input.password, user.password);

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const tokens = await issueTokenPair(deps, user);

    return {
      user: toAuthUser(user),
      tokens,
    };
  };
}
