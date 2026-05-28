import type { FastifyReply } from 'fastify';

import { mapProjectError, type ProjectHttpError } from './map-project-error.js';

function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return names[statusCode] ?? 'Error';
}

export function sendProjectHttpError(reply: FastifyReply, httpError: ProjectHttpError): void {
  void reply.status(httpError.statusCode).send({
    statusCode: httpError.statusCode,
    error: getErrorName(httpError.statusCode),
    message: httpError.message,
    ...(httpError.code !== undefined ? { code: httpError.code } : {}),
  });
}

export function sendMappedProjectError(reply: FastifyReply, error: unknown): void {
  sendProjectHttpError(reply, mapProjectError(error));
}
