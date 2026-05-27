/**
 * Integration tests for POST /auth/register.
 *
 * Setup: No external infrastructure required. Uses buildServer() with in-memory
 * repositories (see tests/helpers/create-auth-test-app.ts).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  postJson,
  postJsonFromIp,
  VALID_PASSWORD,
  validRegisterPayload,
} from '../helpers/auth-http.js';
import {
  createAuthTestApp,
  type AuthTestApp,
} from '../helpers/create-auth-test-app.js';

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
