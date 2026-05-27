import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
} from './dto/index.js';
import { createLoginUseCase } from './login.use-case.js';
import { createLogoutUseCase } from './logout.use-case.js';
import { createRefreshUseCase } from './refresh.use-case.js';
import { createRegisterUseCase } from './register.use-case.js';
import type { AuthUseCaseDependencies, AuthUseCases } from './types.js';

export function createAuthUseCases(deps: AuthUseCaseDependencies): AuthUseCases {
  const register = createRegisterUseCase(deps);
  const login = createLoginUseCase(deps);
  const logout = createLogoutUseCase(deps);
  const refresh = createRefreshUseCase(deps);

  return {
    async register(input: unknown) {
      return register(registerInputSchema.parse(input));
    },

    async login(input: unknown) {
      return login(loginInputSchema.parse(input));
    },

    async logout(input: unknown) {
      return logout(logoutInputSchema.parse(input));
    },

    async refresh(input: unknown) {
      return refresh(refreshInputSchema.parse(input));
    },
  };
}

export function createAuthUseCasesFromInfrastructure(
  auth: Pick<
    AuthUseCaseDependencies,
    'jwtService' | 'passwordHasher' | 'userRepository' | 'refreshTokenRepository'
  >,
  tokenSettings: AuthUseCaseDependencies['tokenSettings'],
): AuthUseCases {
  return createAuthUseCases({
    ...auth,
    tokenSettings,
  });
}
