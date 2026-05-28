import type { buildServer } from '../../src/server.js';
import { expect } from 'vitest';
import { JSON_HEADERS, registerUser } from './auth-http.js';

type TestApp = Awaited<ReturnType<typeof buildServer>>;

function bearerHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

export async function registerAndGetAccessToken(
  app: TestApp,
  overrides: { email?: string; name?: string; password?: string } = {},
) {
  const { response } = await registerUser(app, overrides);
  expect(response.statusCode).toBe(201);
  const body = response.json();

  return {
    response,
    accessToken: body.tokens.accessToken as string,
    user: body.user as { id: string; email: string; name: string },
  };
}

/** Creates a project owned by the bearer of `accessToken` and returns its id. */
export async function createOwnedProject(
  app: TestApp,
  accessToken: string,
  name = 'Task Project',
): Promise<string> {
  const response = await postProject(app, { name }, { accessToken });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

export function postProject(
  app: TestApp,
  payload: unknown,
  options: { accessToken?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = { ...JSON_HEADERS };

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    Object.assign(headers, bearerHeaders(options.accessToken));
  }

  return app.inject({
    method: 'POST',
    url: '/projects',
    headers,
    payload,
  });
}

export function listProjects(
  app: TestApp,
  options: { accessToken?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = {};

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    Object.assign(headers, bearerHeaders(options.accessToken));
  }

  return app.inject({
    method: 'GET',
    url: '/projects',
    headers,
  });
}

export function getProject(
  app: TestApp,
  projectId: string,
  options: { accessToken?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = {};

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    Object.assign(headers, bearerHeaders(options.accessToken));
  }

  return app.inject({
    method: 'GET',
    url: `/projects/${projectId}`,
    headers,
  });
}

export function patchProject(
  app: TestApp,
  projectId: string,
  payload: unknown,
  options: { accessToken?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = { ...JSON_HEADERS };

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    Object.assign(headers, bearerHeaders(options.accessToken));
  }

  return app.inject({
    method: 'PATCH',
    url: `/projects/${projectId}`,
    headers,
    payload,
  });
}

export function deleteProject(
  app: TestApp,
  projectId: string,
  options: { accessToken?: string; authorization?: string } = {},
) {
  const headers: Record<string, string> = {};

  if (options.authorization !== undefined) {
    headers.authorization = options.authorization;
  } else if (options.accessToken !== undefined) {
    Object.assign(headers, bearerHeaders(options.accessToken));
  }

  return app.inject({
    method: 'DELETE',
    url: `/projects/${projectId}`,
    headers,
  });
}
