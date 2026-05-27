import type { FastifyReply } from 'fastify';

import { mapAuthError, type AuthHttpError } from './map-auth-error.js';

function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return names[statusCode] ?? 'Error';
}

export function sendAuthHttpError(reply: FastifyReply, httpError: AuthHttpError): void {
  void reply.status(httpError.statusCode).send({
    statusCode: httpError.statusCode,
    error: getErrorName(httpError.statusCode),
    message: httpError.message,
    ...(httpError.code !== undefined ? { code: httpError.code } : {}),
  });
}

export function sendMappedAuthError(reply: FastifyReply, error: unknown): void {
  sendAuthHttpError(reply, mapAuthError(error));
}
