import type { FastifyError, FastifyInstance } from 'fastify';

function getErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    413: 'Payload Too Large',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  };
  return names[statusCode] ?? 'Error';
}

function getClientMessage(error: FastifyError, statusCode: number): string {
  if (statusCode >= 500) {
    return 'Internal Server Error';
  }

  if (error.validation) {
    return 'Validation failed';
  }

  if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
    return 'Invalid JSON body';
  }

  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return 'Request body too large';
  }

  return error.message;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;

    // Always send the full JSON response first; never destroy the request stream
    // before the client receives the error payload.
    void reply.status(statusCode).send({
      statusCode,
      error: getErrorName(statusCode),
      message: getClientMessage(error, statusCode),
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    });
  });
}
