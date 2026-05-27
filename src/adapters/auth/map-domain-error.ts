import { DomainError } from '../../domain/index.js';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_INVALID_REFRESH_TOKEN: 401,
  AUTH_USER_ALREADY_EXISTS: 409,
  AUTH_INVALID_PASSWORD: 422,
  AUTH_INVALID_EMAIL: 422,
  AUTH_INVALID_NAME: 422,
  AUTH_USER_NOT_FOUND: 404,
};

export function mapDomainErrorToStatusCode(error: DomainError): number {
  return DOMAIN_ERROR_STATUS[error.code] ?? 500;
}
