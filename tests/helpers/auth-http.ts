import type { buildServer } from '../../src/server.js';

export const JSON_HEADERS = {
  'content-type': 'application/json',
} as const;

export const VALID_PASSWORD = 'Password1';

export const validRegisterPayload = {
  email: 'user@example.com',
  name: 'Test User',
  password: VALID_PASSWORD,
} as const;

type TestApp = Awaited<ReturnType<typeof buildServer>>;

export function postJson(
  app: TestApp,
  url: string,
  payload: unknown,
  extraHeaders?: Record<string, string>,
) {
  return app.inject({
    method: 'POST',
    url,
    headers: { ...JSON_HEADERS, ...extraHeaders },
    payload,
  });
}

export function postJsonFromIp(
  app: TestApp,
  url: string,
  payload: unknown,
  clientIp: string,
  extraHeaders?: Record<string, string>,
) {
  return postJson(app, url, payload, {
    'x-forwarded-for': clientIp,
    ...extraHeaders,
  });
}

export async function registerUser(
  app: TestApp,
  overrides: Partial<typeof validRegisterPayload> = {},
) {
  const payload = { ...validRegisterPayload, ...overrides };
  const response = await postJson(app, '/auth/register', payload);
  return { response, payload };
}
