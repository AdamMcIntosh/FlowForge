import type { buildServer } from '../../src/server.js';

import { JSON_HEADERS } from './auth-http.js';

export { createOwnedProject } from './project-http.js';

type TestApp = Awaited<ReturnType<typeof buildServer>>;

function bearerHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

function authHeaders(options: { accessToken?: string; authorization?: string } = {}): Record<string, string> {
  if (options.authorization !== undefined) {
    return { authorization: options.authorization };
  }

  if (options.accessToken !== undefined) {
    return bearerHeaders(options.accessToken);
  }

  return {};
}

export function postTask(
  app: TestApp,
  projectId: string,
  payload: unknown,
  options: { accessToken?: string; authorization?: string } = {},
) {
  return app.inject({
    method: 'POST',
    url: `/projects/${projectId}/tasks`,
    headers: { ...JSON_HEADERS, ...authHeaders(options) },
    payload,
  });
}

export function listTasks(
  app: TestApp,
  projectId: string,
  options: { accessToken?: string; authorization?: string } = {},
) {
  return app.inject({
    method: 'GET',
    url: `/projects/${projectId}/tasks`,
    headers: authHeaders(options),
  });
}

export function getTask(
  app: TestApp,
  taskId: string,
  options: { accessToken?: string; authorization?: string } = {},
) {
  return app.inject({
    method: 'GET',
    url: `/tasks/${taskId}`,
    headers: authHeaders(options),
  });
}

export function patchTask(
  app: TestApp,
  taskId: string,
  payload: unknown,
  options: { accessToken?: string; authorization?: string } = {},
) {
  return app.inject({
    method: 'PATCH',
    url: `/tasks/${taskId}`,
    headers: { ...JSON_HEADERS, ...authHeaders(options) },
    payload,
  });
}

export function deleteTask(
  app: TestApp,
  taskId: string,
  options: { accessToken?: string; authorization?: string } = {},
) {
  return app.inject({
    method: 'DELETE',
    url: `/tasks/${taskId}`,
    headers: authHeaders(options),
  });
}
