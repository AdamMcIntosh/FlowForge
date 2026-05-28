/**
 * Integration tests for /auth/* HTTP endpoints and rate limiting.
 *
 * Setup: No external infrastructure required. Uses buildServer() with in-memory
 * user repository (see tests/helpers/create-auth-test-app.ts).
 * Each describe block creates a fresh app and rate limiter to avoid cross-test leakage.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNoOpRateLimiter } from '../src/infrastructure/auth/rate-limiter.js';
import {
  postJson,
  postJsonFromIp,
  registerUser,
  VALID_PASSWORD,
  validRegisterPayload,
} from './helpers/auth-http.js';
import {
  createAuthTestApp,
  type AuthTestApp,
} from './helpers/create-auth-test-app.js';

describe('POST /auth/register', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 201 with user profile and access token for valid input', async () => {
    const response = await postJson(testApp.app, '/auth/register', validRegisterPayload);

    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.user).toEqual({
      id: expect.any(String),
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(body.tokens).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });

    const claims = testApp.jwtService.verifyAccessToken(body.tokens.accessToken);
    expect(claims.jti).toEqual(expect.any(String));
    expect(claims.sub).toBe(body.user.id);
  });

  it('returns 400 with VALIDATION_ERROR when required fields are missing', async () => {
    const response = await postJson(testApp.app, '/auth/register', {});

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Email is required',
    });
  });

  it('returns 400 with VALIDATION_ERROR when name is missing', async () => {
    const response = await postJson(testApp.app, '/auth/register', {
      email: validRegisterPayload.email,
      password: VALID_PASSWORD,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Name is required',
    });
  });

  it('returns 400 with VALIDATION_ERROR for an invalid email address', async () => {
    const response = await postJson(testApp.app, '/auth/register', {
      ...validRegisterPayload,
      email: 'not-an-email',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Invalid email address',
    });
  });

  it('returns 400 with VALIDATION_ERROR when the password fails complexity rules', async () => {
    const response = await postJson(testApp.app, '/auth/register', {
      ...validRegisterPayload,
      password: 'passwordonly',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Password must contain at least one number',
    });
  });

  it('returns 409 when the email is already registered', async () => {
    const first = await postJson(testApp.app, '/auth/register', validRegisterPayload);
    expect(first.statusCode).toBe(201);

    const second = await postJson(testApp.app, '/auth/register', {
      ...validRegisterPayload,
      name: 'Another Name',
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'A user with this email already exists',
      code: 'AUTH_USER_ALREADY_EXISTS',
    });
  });

  it('returns 409 when registering with a case-variant of an existing email', async () => {
    const first = await postJson(testApp.app, '/auth/register', validRegisterPayload);
    expect(first.statusCode).toBe(201);

    const second = await postJson(testApp.app, '/auth/register', {
      ...validRegisterPayload,
      email: 'USER@EXAMPLE.COM',
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      statusCode: 409,
      code: 'AUTH_USER_ALREADY_EXISTS',
    });
  });
});

describe('POST /auth/register per-email rate limiting', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp({ rateLimitMaxRequests: 3 });
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 429 when duplicate registration attempts exhaust the per-email limit', async () => {
    await postJsonFromIp(testApp.app, '/auth/register', validRegisterPayload, '203.0.113.1');

    await postJsonFromIp(
      testApp.app,
      '/auth/register',
      { ...validRegisterPayload, name: 'Duplicate One' },
      '203.0.113.2',
    );
    await postJsonFromIp(
      testApp.app,
      '/auth/register',
      { ...validRegisterPayload, name: 'Duplicate Two' },
      '203.0.113.3',
    );

    const blocked = await postJsonFromIp(
      testApp.app,
      '/auth/register',
      { ...validRegisterPayload, name: 'Duplicate Three' },
      '203.0.113.4',
    );

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toEqual(expect.any(String));
    expect(blocked.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });
});

describe('POST /auth/login', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
    const { response } = await registerUser(testApp.app);
    expect(response.statusCode).toBe(201);
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with user profile and tokens for valid credentials', async () => {
    const response = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: VALID_PASSWORD,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.user).toEqual({
      id: expect.any(String),
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(body.tokens).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });
  });

  it('returns 400 with VALIDATION_ERROR when credentials are incomplete', async () => {
    const response = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Password is required',
    });
  });

  it('returns the same 401 response for unknown email and wrong password', async () => {
    const unknownUser = await postJson(testApp.app, '/auth/login', {
      email: 'missing@example.com',
      password: VALID_PASSWORD,
    });

    const wrongPassword = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });

    expect(unknownUser.statusCode).toBe(401);
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.json()).toEqual(wrongPassword.json());
    expect(unknownUser.json()).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid email or password',
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });
});

describe('auth endpoint flows', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('supports register → login with distinct access tokens', async () => {
    const register = await postJson(testApp.app, '/auth/register', {
      email: 'flow@example.com',
      name: 'Flow User',
      password: VALID_PASSWORD,
    });
    expect(register.statusCode).toBe(201);

    const registerToken = register.json().tokens.accessToken;

    const login = await postJson(testApp.app, '/auth/login', {
      email: 'flow@example.com',
      password: VALID_PASSWORD,
    });
    expect(login.statusCode).toBe(200);

    const loginToken = login.json().tokens.accessToken;
    expect(loginToken).not.toBe(registerToken);

    const registerClaims = testApp.jwtService.verifyAccessToken(registerToken);
    const loginClaims = testApp.jwtService.verifyAccessToken(loginToken);
    expect(registerClaims.jti).not.toBe(loginClaims.jti);
  });
});

describe('auth early rate limiting', () => {
  let testApp: AuthTestApp;

  afterEach(async () => {
    if (testApp) {
      await testApp.app.close();
    }
  });

  it('returns 429 before body parsing when the early hook rate limit is exceeded', async () => {
    testApp = await createAuthTestApp({
      rateLimiter: {
        check() {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 45,
          };
        },
        checkMany() {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 45,
          };
        },
      },
    });

    const response = await testApp.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{ not valid json',
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('45');
    expect(response.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });

  it('does not apply auth rate limits to non-auth routes', async () => {
    testApp = await createAuthTestApp({
      rateLimiter: {
        check() {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
        checkMany() {
          return {
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
            retryAfterSeconds: 60,
          };
        },
      },
    });

    const response = await testApp.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns 429 at the early hook when the authenticated user key is exhausted', async () => {
    testApp = await createAuthTestApp({ rateLimitMaxRequests: 3 });

    const { response: registerResponse } = await registerUser(testApp.app, {
      email: 'bearer@example.com',
    });
    const accessToken = registerResponse.json().tokens.accessToken;

    const clientIps = ['203.0.113.10', '203.0.113.11', '203.0.113.12'];

    for (const clientIp of clientIps) {
      const login = await testApp.app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
          'x-forwarded-for': clientIp,
        },
        payload: '{ incomplete',
      });
      expect(login.statusCode).not.toBe(429);
    }

    const blocked = await testApp.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
        'x-forwarded-for': '203.0.113.13',
      },
      payload: '{ malformed',
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toEqual(expect.any(String));
    expect(blocked.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });
});

describe('auth post-body email rate limiting', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp({ rateLimitMaxRequests: 3 });
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 429 on login when the per-email limit is exhausted across different client IPs', async () => {
    await postJsonFromIp(testApp.app, '/auth/register', validRegisterPayload, '203.0.113.1');
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '203.0.113.2',
    );
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '203.0.113.3',
    );

    const blocked = await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '203.0.113.4',
    );

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toEqual(expect.any(String));
    expect(blocked.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });

  it('does not block a different email when only one address is rate limited', async () => {
    await postJsonFromIp(testApp.app, '/auth/register', validRegisterPayload, '198.51.100.1');
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '198.51.100.2',
    );
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '198.51.100.3',
    );

    const exhaustedEmailAttempt = await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: validRegisterPayload.email, password: 'WrongPassword1' },
      '198.51.100.4',
    );
    expect(exhaustedEmailAttempt.statusCode).toBe(429);

    const otherEmail = await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: 'other@example.com', password: VALID_PASSWORD },
      '198.51.100.5',
    );

    expect(otherEmail.statusCode).toBe(401);
    expect(otherEmail.json()).toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('normalizes email casing before applying the per-email rate limit key', async () => {
    await postJsonFromIp(testApp.app, '/auth/register', validRegisterPayload, '192.0.2.1');
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: 'USER@EXAMPLE.COM', password: 'WrongPassword1' },
      '192.0.2.2',
    );
    await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: 'user@example.com', password: 'WrongPassword1' },
      '192.0.2.3',
    );

    const blocked = await postJsonFromIp(
      testApp.app,
      '/auth/login',
      { email: 'User@Example.com', password: 'WrongPassword1' },
      '192.0.2.4',
    );

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({
      statusCode: 429,
      message: 'Rate limit exceeded',
    });
  });
});

describe('auth shared rate limiter exhaustion', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp({ rateLimitMaxRequests: 6 });
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 429 after repeated login attempts exhaust the fixed window', async () => {
    await postJson(testApp.app, '/auth/register', validRegisterPayload);

    const first = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });
    expect(first.statusCode).toBe(401);

    const second = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });
    expect(second.statusCode).toBe(401);

    const third = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });
    expect(third.statusCode).toBe(429);
    expect(third.headers['retry-after']).toEqual(expect.any(String));
    expect(third.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });

  it('returns 429 on register when the rate limit is already exhausted by prior auth traffic', async () => {
    await postJson(testApp.app, '/auth/register', validRegisterPayload);

    await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });
    await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: 'WrongPassword1',
    });

    const response = await postJson(testApp.app, '/auth/register', {
      email: 'other@example.com',
      name: 'Other User',
      password: VALID_PASSWORD,
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });
  });
});

describe('auth routes with no-op rate limiter', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp({ rateLimiter: createNoOpRateLimiter() });
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 400 for malformed JSON without being blocked by rate limiting', async () => {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: '{ invalid json',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid JSON body',
    });
  });

  it('allows validation errors through when rate limiting is disabled', async () => {
    const response = await postJson(testApp.app, '/auth/login', {});

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });
});
