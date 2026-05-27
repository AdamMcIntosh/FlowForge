import { beforeEach, describe, expect, it } from 'vitest';

import { InvalidPasswordError } from './errors.js';
import { Password } from './password.js';

describe('Password', () => {
  describe('validatePlaintext', () => {
    it('accepts passwords that meet policy', () => {
      expect(() => Password.validatePlaintext('Password1')).not.toThrow();
    });

    it('accepts passwords at exactly the minimum length (8)', () => {
      expect(() => Password.validatePlaintext('Passwor1')).not.toThrow();
    });

    it('accepts passwords at exactly the maximum length (128)', () => {
      const atMax = `A1${'a'.repeat(126)}`;
      expect(atMax).toHaveLength(128);
      expect(() => Password.validatePlaintext(atMax)).not.toThrow();
    });

    it('rejects passwords shorter than 8 characters with a specific message', () => {
      expect(() => Password.validatePlaintext('Pass1')).toThrow(
        new InvalidPasswordError('Password must be at least 8 characters'),
      );
    });

    it('rejects passwords longer than 128 characters with a specific message', () => {
      const tooLong = `A1${'a'.repeat(127)}`;
      expect(tooLong.length).toBeGreaterThan(128);

      expect(() => Password.validatePlaintext(tooLong)).toThrow(
        new InvalidPasswordError('Password must be at most 128 characters'),
      );
    });

    it('rejects passwords without a letter with a specific message', () => {
      expect(() => Password.validatePlaintext('12345678')).toThrow(
        new InvalidPasswordError('Password must contain at least one letter'),
      );
    });

    it('rejects passwords without a number with a specific message', () => {
      expect(() => Password.validatePlaintext('Password')).toThrow(
        new InvalidPasswordError('Password must contain at least one number'),
      );
    });

    it('uses InvalidPasswordError with the AUTH_INVALID_PASSWORD code', () => {
      try {
        Password.validatePlaintext('short');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPasswordError);
        expect((error as InvalidPasswordError).code).toBe('AUTH_INVALID_PASSWORD');
      }
    });
  });

  describe('fromHash', () => {
    it('wraps a non-empty hash and exposes it via getHash()', () => {
      const password = Password.fromHash('$argon2id$v=19$hash');

      expect(password.getHash()).toBe('$argon2id$v=19$hash');
    });

    it('trims surrounding whitespace from the hash', () => {
      const password = Password.fromHash('  $argon2id$v=19$hash  ');

      expect(password.getHash()).toBe('$argon2id$v=19$hash');
    });

    it('rejects whitespace-only hashes', () => {
      expect(() => Password.fromHash('   ')).toThrow(
        new InvalidPasswordError('Password hash cannot be empty'),
      );
    });

    it('rejects an empty string hash', () => {
      expect(() => Password.fromHash('')).toThrow(
        new InvalidPasswordError('Password hash cannot be empty'),
      );
    });

    it('uses InvalidPasswordError with the AUTH_INVALID_PASSWORD code for empty hashes', () => {
      try {
        Password.fromHash('');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPasswordError);
        expect((error as InvalidPasswordError).code).toBe('AUTH_INVALID_PASSWORD');
      }
    });
  });

  describe('immutability', () => {
    let password: Password;

    beforeEach(() => {
      password = Password.fromHash('$argon2id$v=19$hash');
    });

    it('returns the same hash on repeated getHash() calls', () => {
      expect(password.getHash()).toBe(password.getHash());
    });
  });
});
