import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

import { DomainError } from '../../domain/index.js';
import { mapDomainErrorToStatusCode } from './map-domain-error.js';

function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return names[statusCode] ?? 'Error';
}

export async function handleAuthError(error: unknown, reply: FastifyReply): Promise<void> {
  if (error instanceof ZodError) {
    void reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
    });
    return;
  }

  if (error instanceof DomainError) {
    const statusCode = mapDomainErrorToStatusCode(error);
    void reply.status(statusCode).send({
      statusCode,
      error: getErrorName(statusCode),
      message: error.message,
    });
    return;
  }

  throw error;
}
