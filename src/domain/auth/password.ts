import { InvalidPasswordError } from './errors.js';

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const HAS_LETTER = /[A-Za-z]/;
const HAS_NUMBER = /\d/;

export class Password {
  private constructor(private readonly hashedValue: string) {}

  static validatePlaintext(plaintext: string): void {
    if (plaintext.length < MIN_LENGTH) {
      throw new InvalidPasswordError(
        `Password must be at least ${String(MIN_LENGTH)} characters`,
      );
    }

    if (plaintext.length > MAX_LENGTH) {
      throw new InvalidPasswordError(
        `Password must be at most ${String(MAX_LENGTH)} characters`,
      );
    }

    if (!HAS_LETTER.test(plaintext)) {
      throw new InvalidPasswordError('Password must contain at least one letter');
    }

    if (!HAS_NUMBER.test(plaintext)) {
      throw new InvalidPasswordError('Password must contain at least one number');
    }
  }

  static fromHash(hash: string): Password {
    const trimmed = hash.trim();
    if (trimmed.length === 0) {
      throw new InvalidPasswordError('Password hash cannot be empty');
    }

    return new Password(trimmed);
  }

  getHash(): string {
    return this.hashedValue;
  }
}
