import { beforeEach, describe, expect, it } from 'vitest';

import { InvalidEmailError, InvalidNameError } from './errors.js';
import { Password } from './password.js';
import { User } from './user.js';

describe('User', () => {
  let passwordHash: Password;

  beforeEach(() => {
    passwordHash = Password.fromHash('$argon2id$v=19$hash');
  });

  describe('validateEmail', () => {
    it('returns normalized email for valid input', () => {
      expect(User.validateEmail('  User@Example.com  ')).toBe('user@example.com');
    });

    it('throws InvalidEmailError for invalid addresses', () => {
      expect(() => User.validateEmail('not-an-email')).toThrow(InvalidEmailError);
      expect(() => User.validateEmail('user@localhost')).toThrow(InvalidEmailError);
    });
  });

  describe('validateName', () => {
    it('returns trimmed name for valid input', () => {
      expect(User.validateName('  Ada Lovelace  ')).toBe('Ada Lovelace');
    });

    it('throws InvalidNameError for empty or oversized names', () => {
      expect(() => User.validateName('   ')).toThrow(
        new InvalidNameError('Name is required'),
      );
      expect(() => User.validateName('a'.repeat(256))).toThrow(
        new InvalidNameError('Name must be at most 255 characters'),
      );
    });
  });

  describe('create', () => {
    it('normalizes email and name', () => {
      const user = User.create({
        id: 'user-1',
        email: '  User@Example.com  ',
        name: '  Ada Lovelace  ',
        passwordHash,
      });

      expect(user.email).toBe('user@example.com');
      expect(user.name).toBe('Ada Lovelace');
      expect(user.id).toBe('user-1');
      expect(user.password).toBe(passwordHash);
      expect(user.createdAt).toEqual(user.updatedAt);
    });

    it('uses the provided createdAt for both timestamps when supplied', () => {
      const createdAt = new Date('2024-06-15T10:00:00.000Z');

      const user = User.create({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        passwordHash,
        createdAt,
      });

      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(createdAt);
    });

    it('rejects invalid email addresses', () => {
      expect(() =>
        User.create({
          id: 'user-1',
          email: 'not-an-email',
          name: 'Ada',
          passwordHash,
        }),
      ).toThrow(InvalidEmailError);
    });

    it('rejects emails without a domain segment', () => {
      expect(() =>
        User.create({
          id: 'user-1',
          email: 'user@localhost',
          name: 'Ada',
          passwordHash,
        }),
      ).toThrow(InvalidEmailError);
    });

    it('rejects emails with internal whitespace', () => {
      expect(() =>
        User.create({
          id: 'user-1',
          email: 'user @example.com',
          name: 'Ada',
          passwordHash,
        }),
      ).toThrow(InvalidEmailError);
    });

    it('rejects empty names after trimming', () => {
      expect(() =>
        User.create({
          id: 'user-1',
          email: 'ada@example.com',
          name: '   ',
          passwordHash,
        }),
      ).toThrow(new InvalidNameError('Name is required'));
    });

    it('rejects names longer than 255 characters', () => {
      expect(() =>
        User.create({
          id: 'user-1',
          email: 'ada@example.com',
          name: 'a'.repeat(256),
          passwordHash,
        }),
      ).toThrow(
        new InvalidNameError('Name must be at most 255 characters'),
      );
    });

    it('accepts names at exactly 255 characters', () => {
      const user = User.create({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'a'.repeat(255),
        passwordHash,
      });

      expect(user.name).toHaveLength(255);
    });
  });

  describe('reconstitute', () => {
    it('re-applies normalization from persistence', () => {
      const createdAt = new Date('2025-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-01-02T00:00:00.000Z');

      const user = User.reconstitute({
        id: 'user-1',
        email: 'USER@EXAMPLE.COM',
        name: '  Ada  ',
        password: passwordHash,
        createdAt,
        updatedAt,
      });

      expect(user.email).toBe('user@example.com');
      expect(user.name).toBe('Ada');
      expect(user.id).toBe('user-1');
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
    });

    it('rejects invalid email on reconstitute', () => {
      expect(() =>
        User.reconstitute({
          id: 'user-1',
          email: 'bad-email',
          name: 'Ada',
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidEmailError);
    });

    it('rejects empty name on reconstitute', () => {
      expect(() =>
        User.reconstitute({
          id: 'user-1',
          email: 'ada@example.com',
          name: '  ',
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow(InvalidNameError);
    });

    it('preserves distinct createdAt and updatedAt from persistence', () => {
      const createdAt = new Date('2023-01-01T00:00:00.000Z');
      const updatedAt = new Date('2025-05-27T12:00:00.000Z');

      const user = User.reconstitute({
        id: 'persisted-id',
        email: 'ada@example.com',
        name: 'Ada',
        password: passwordHash,
        createdAt,
        updatedAt,
      });

      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
      expect(user.createdAt).not.toBe(user.updatedAt);
    });
  });

  describe('toProps', () => {
    it('returns a snapshot of entity state', () => {
      const user = User.create({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        passwordHash,
      });

      expect(user.toProps()).toEqual({
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada',
        password: passwordHash,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    });

    it('includes normalized values after create with messy input', () => {
      const user = User.create({
        id: 'user-2',
        email: '  BOB@Example.COM ',
        name: '  Bob  ',
        passwordHash,
      });

      const props = user.toProps();

      expect(props.email).toBe('bob@example.com');
      expect(props.name).toBe('Bob');
    });
  });
});
