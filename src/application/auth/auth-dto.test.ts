import { describe, expect, it } from 'vitest';

import {
  authResultSchema,
  authTokensSchema,
  authUserSchema,
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema,
} from './dto/index.js';

describe('auth DTO schemas', () => {
  it('returns field-specific messages when register input is missing', () => {
    const result = registerInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Email is required');
    }
  });

  it('returns field-specific messages when logout input is missing', () => {
    const result = logoutInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Refresh token is required');
    }
  });

  it('returns field-specific messages when refresh input is missing', () => {
    const result = refreshInputSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Refresh token is required');
    }
  });

  it('returns field-specific messages when login input is incomplete', () => {
    const result = loginInputSchema.safeParse({ email: 'user@example.com' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Password is required');
    }
  });

  it('validates register input including password complexity', () => {
    expect(
      registerInputSchema.safeParse({
        email: 'user@example.com',
        name: 'Test User',
        password: 'Password1',
      }).success,
    ).toBe(true);

    expect(
      registerInputSchema.safeParse({
        email: 'user@example.com',
        name: 'Test User',
        password: 'passwordonly',
      }).success,
    ).toBe(false);
  });

  it('rejects register input with invalid email format', () => {
    const result = registerInputSchema.safeParse({
      email: 'not-an-email',
      name: 'Test User',
      password: 'Password1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'Invalid email address')).toBe(
        true,
      );
    }
  });

  it('rejects register input with empty name after trimming', () => {
    const result = registerInputSchema.safeParse({
      email: 'user@example.com',
      name: '   ',
      password: 'Password1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Name is required');
    }
  });

  it('rejects register input with name longer than 255 characters', () => {
    const result = registerInputSchema.safeParse({
      email: 'user@example.com',
      name: 'a'.repeat(256),
      password: 'Password1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Name must be at most 255 characters');
    }
  });

  it('rejects register passwords shorter than 8 characters at the application boundary', () => {
    const result = registerInputSchema.safeParse({
      email: 'user@example.com',
      name: 'Test User',
      password: 'Pass1',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Password must be at least 8 characters');
    }
  });

  it('accepts login input without revealing email format requirements', () => {
    expect(
      loginInputSchema.safeParse({
        email: 'not-an-email',
        password: 'secret',
      }).success,
    ).toBe(true);
  });

  describe('output schemas', () => {
    it('validates auth token response shape', () => {
      expect(
        authTokensSchema.safeParse({
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 900,
        }).success,
      ).toBe(true);

      expect(
        authTokensSchema.safeParse({
          accessToken: '',
          expiresIn: 900,
        }).success,
      ).toBe(false);

      expect(
        authTokensSchema.safeParse({
          accessToken: 'access',
          expiresIn: 0,
        }).success,
      ).toBe(false);
    });

    it('validates auth user response shape', () => {
      expect(
        authUserSchema.safeParse({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
        }).success,
      ).toBe(true);

      expect(
        authUserSchema.safeParse({
          id: '',
          email: 'user@example.com',
          name: 'Test User',
        }).success,
      ).toBe(false);
    });

    it('validates combined auth result shape', () => {
      expect(
        authResultSchema.safeParse({
          user: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
          },
          tokens: {
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresIn: 900,
          },
        }).success,
      ).toBe(true);
    });
  });
});
