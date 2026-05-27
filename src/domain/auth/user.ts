import { InvalidEmailError, InvalidNameError } from './errors.js';
import type { Password } from './password.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 255;

export type UserId = string;

export type UserProps = {
  id: UserId;
  email: string;
  name: string;
  password: Password;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: Password;
  id: UserId;
  createdAt?: Date;
};

export class User {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly password: Password;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.password = props.password;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Validates and normalizes email before expensive work (e.g. password hashing). */
  static validateEmail(email: string): string {
    return User.normalizeEmail(email);
  }

  /** Validates and normalizes name before expensive work (e.g. password hashing). */
  static validateName(name: string): string {
    return User.normalizeName(name);
  }

  static create(input: CreateUserInput): User {
    const email = User.validateEmail(input.email);
    const name = User.validateName(input.name);
    const now = input.createdAt ?? new Date();

    return new User({
      id: input.id,
      email,
      name,
      password: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User({
      id: props.id,
      email: User.validateEmail(props.email),
      name: User.validateName(props.name),
      password: props.password,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  toProps(): UserProps {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      password: this.password,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }

    return normalized;
  }

  private static normalizeName(name: string): string {
    const normalized = name.trim();

    if (normalized.length < MIN_NAME_LENGTH) {
      throw new InvalidNameError('Name is required');
    }

    if (normalized.length > MAX_NAME_LENGTH) {
      throw new InvalidNameError(
        `Name must be at most ${String(MAX_NAME_LENGTH)} characters`,
      );
    }

    return normalized;
  }
}
