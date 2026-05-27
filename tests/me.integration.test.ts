/**
 * Integration tests for GET /me protected endpoint.
 *
 * Setup: No external infrastructure required. Uses buildServer() with in-memory
 * repositories (see tests/helpers/create-auth-test-app.ts).
 * Each describe block creates a fresh app to avoid cross-test state leakage.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { buildServer } from '../src/server.js';
import { postJson, registerUser, VALID_PASSWORD, validRegisterPayload } from './helpers/auth-http.js';
import {
  createAuthTestApp,
  type AuthTestApp,
} from './helpers/create-auth-test-app.js';

type TestApp = Awaited<ReturnType<typeof buildServer>>;

const unauthorizedBody = (message: string) => ({
  statusCode: 401,
  error: 'Unauthorized',
  message,
  code: 'AUTH_UNAUTHORIZED',
});

function getMe(app: TestApp, options: { accessToken?: string; authorization?: string } = {}) {
  const headers: Record<string, string> = {};

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  return app.inject({
    method: 'GET',
    url: '/me',
    headers,
  });
}

function expiredTokenDates(): { issuedAt: Date; expiresAt: Date } {
  return {
    issuedAt: new Date('2020-01-01T00:00:00.000Z'),
    expiresAt: new Date('2020-01-02T00:00:00.000Z'),
  };
}

function futureTokenDates(): { issuedAt: Date; expiresAt: Date } {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1000);
  return { issuedAt, expiresAt };
}

describe('GET /me', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 200 with user id and email when a valid access token is provided', async () => {
    const { response: registerResponse } = await registerUser(testApp.app);
    expect(registerResponse.statusCode).toBe(201);

    const registerBody = registerResponse.json();
    const response = await getMe(testApp.app, { accessToken: registerBody.tokens.accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: registerBody.user.id,
      email: registerBody.user.email,
    });
  });

  it('returns the authenticated user profile after login', async () => {
    const { response: registerResponse } = await registerUser(testApp.app, {
      email: 'me@example.com',
      name: 'Me User',
    });
    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await postJson(testApp.app, '/auth/login', {
      email: 'me@example.com',
      password: VALID_PASSWORD,
    });
    expect(loginResponse.statusCode).toBe(200);

    const accessToken = loginResponse.json().tokens.accessToken;
    const meResponse = await getMe(testApp.app, { accessToken });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({
      id: registerResponse.json().user.id,
      email: 'me@example.com',
    });
  });

  it('maps token claims sub to id and email in the response body', async () => {
    const { response: registerResponse } = await registerUser(testApp.app);
    expect(registerResponse.statusCode).toBe(201);

    const accessToken = registerResponse.json().tokens.accessToken;
    const claims = testApp.jwtService.verifyAccessToken(accessToken);

    const response = await getMe(testApp.app, { accessToken });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: claims.sub,
      email: claims.email,
    });
  });
});

describe('GET /me unauthorized', () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp();
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  it('returns 401 AUTH_UNAUTHORIZED when no authorization header is present', async () => {
    const response = await getMe(testApp.app);

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });

  it('returns 401 when authorization uses a non-bearer scheme', async () => {
    const response = await getMe(testApp.app, {
      authorization: 'Basic dXNlcjpwYXNz',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });

  it('returns 401 when the bearer token is empty', async () => {
    const response = await getMe(testApp.app, { authorization: 'Bearer   ' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Authentication required'));
  });

  it('returns 401 for a malformed token', async () => {
    const response = await getMe(testApp.app, { accessToken: 'not-a-jwt' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });

  it('returns 401 for an expired access token', async () => {
    const { issuedAt, expiresAt } = expiredTokenDates();
    const signed = testApp.jwtService.signAccessToken({
      userId: 'user-expired',
      email: 'expired@example.com',
      issuedAt,
      expiresAt,
    });

    const response = await getMe(testApp.app, { accessToken: signed.token });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });

  it('returns 401 when a refresh token is presented as a bearer token', async () => {
    const { response: registerResponse } = await registerUser(testApp.app);
    expect(registerResponse.statusCode).toBe(201);

    const refreshToken = registerResponse.json().tokens.refreshToken;
    const response = await getMe(testApp.app, { accessToken: refreshToken });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });

  it('returns 401 when the access token signature is tampered with', async () => {
    const { response: registerResponse } = await registerUser(testApp.app);
    expect(registerResponse.statusCode).toBe(201);

    const accessToken = registerResponse.json().tokens.accessToken;
    const tamperedToken = `${accessToken.slice(0, -1)}x`;

    const response = await getMe(testApp.app, { accessToken: tamperedToken });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(unauthorizedBody('Invalid or expired token'));
  });

  it('does not return user profile fields on unauthorized responses', async () => {
    const response = await getMe(testApp.app);

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('email');
  });
});

describe('GET /me and auth rate limiting', () => {
  let testApp: AuthTestApp;

  afterEach(async () => {
    if (testApp) {
      await testApp.app.close();
    }
  });

  it('remains reachable when auth routes are blocked by the early rate limiter', async () => {
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

    const blockedAuth = await postJson(testApp.app, '/auth/login', {
      email: validRegisterPayload.email,
      password: VALID_PASSWORD,
    });
    expect(blockedAuth.statusCode).toBe(429);

    const { issuedAt, expiresAt } = futureTokenDates();
    const signed = testApp.jwtService.signAccessToken({
      userId: 'user-me',
      email: 'me@example.com',
      issuedAt,
      expiresAt,
    });

    const meResponse = await getMe(testApp.app, { accessToken: signed.token });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({
      id: 'user-me',
      email: 'me@example.com',
    });
  });
});
