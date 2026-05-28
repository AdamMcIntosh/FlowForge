import type { FastifyReply } from 'fastify';

import { mapTaskError, type TaskHttpError } from './map-task-error.js';

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

export function sendTaskHttpError(reply: FastifyReply, httpError: TaskHttpError): void {
  void reply.status(httpError.statusCode).send({
    statusCode: httpError.statusCode,
    error: getErrorName(httpError.statusCode),
    message: httpError.message,
    ...(httpError.code !== undefined ? { code: httpError.code } : {}),
  });
}

export function sendMappedTaskError(reply: FastifyReply, error: unknown): void {
  sendTaskHttpError(reply, mapTaskError(error));
}
