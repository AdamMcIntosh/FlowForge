import { DomainError } from '../errors.js';

export class InvalidCredentialsError extends DomainError {
  constructor(message = 'Invalid email or password') {
    super(message, 'AUTH_INVALID_CREDENTIALS');
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(message = 'A user with this email already exists') {
    super(message, 'AUTH_USER_ALREADY_EXISTS');
  }
}

export class InvalidPasswordError extends DomainError {
  constructor(message = 'Password does not meet requirements') {
    super(message, 'AUTH_INVALID_PASSWORD');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor(message = 'Invalid or expired refresh token') {
    super(message, 'AUTH_INVALID_REFRESH_TOKEN');
  }
}

export class UserNotFoundError extends DomainError {
  constructor(message = 'User not found') {
    super(message, 'AUTH_USER_NOT_FOUND');
  }
}

export class InvalidEmailError extends DomainError {
  constructor(message = 'Invalid email address') {
    super(message, 'AUTH_INVALID_EMAIL');
  }
}

export class InvalidNameError extends DomainError {
  constructor(message = 'Invalid name') {
    super(message, 'AUTH_INVALID_NAME');
  }
}
