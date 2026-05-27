import type {
  JwtService,
  PasswordHasher,
  RefreshTokenRepository,
  UserRepository,
} from '../../infrastructure/auth/types.js';
import type { AuthResultDto, RefreshResultDto } from './dto/index.js';

export type AuthTokenSettings = {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
};

export type AuthUseCaseDependencies = {
  jwtService: JwtService;
  passwordHasher: PasswordHasher;
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  tokenSettings: AuthTokenSettings;
};

export type AuthUseCases = {
  register(input: unknown): Promise<AuthResultDto>;
  login(input: unknown): Promise<AuthResultDto>;
  logout(input: unknown): Promise<void>;
  refresh(input: unknown): Promise<RefreshResultDto>;
};

export type { AuthResultDto, AuthTokensDto, AuthUserDto, RefreshResultDto } from './dto/index.js';
export type {
  LoginInputDto,
  LogoutInputDto,
  RefreshInputDto,
  RegisterInputDto,
} from './dto/index.js';
