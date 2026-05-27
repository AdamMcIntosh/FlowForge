import { randomUUID } from 'node:crypto';

import { Password, User, UserAlreadyExistsError } from '../../domain/index.js';
import type { PasswordHasher, UserRepository } from '../../infrastructure/auth/types.js';
import type { AuthResultDto, RegisterInputDto } from './dto/index.js';
import { issueTokenPair, toAuthUser, type IssueTokenPairDeps } from './token-pair.js';

export type RegisterUseCaseDeps = IssueTokenPairDeps & {
  passwordHasher: PasswordHasher;
  userRepository: UserRepository;
};

export function createRegisterUseCase(deps: RegisterUseCaseDeps) {
  return async function register(input: RegisterInputDto): Promise<AuthResultDto> {
    if (await deps.userRepository.existsByEmail(input.email)) {
      throw new UserAlreadyExistsError();
    }

    const email = User.validateEmail(input.email);
    const name = User.validateName(input.name);
    Password.validatePlaintext(input.password);

    const passwordHash = await deps.passwordHasher.hash(input.password);
    const user = User.create({
      id: randomUUID(),
      email,
      name,
      passwordHash,
    });

    const savedUser = await deps.userRepository.save(user);
    const tokens = await issueTokenPair(deps, savedUser);

    return {
      user: toAuthUser(savedUser),
      tokens,
    };
  };
}
