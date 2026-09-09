import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../lib/errors.js';

interface ErrorResponseBody {
  code: string;
  message: string;
  issues?: unknown;
}

function handleDomainError(error: DomainError, reply: FastifyReply): void {
  const body: ErrorResponseBody = { code: error.code, message: error.message };
  reply.status(error.statusCode).send(body);
}

function handleZodError(error: ZodError, reply: FastifyReply): void {
  const body: ErrorResponseBody = {
    code: 'VALIDATION_ERROR',
    message: 'La solicitud no cumple con el esquema esperado',
    issues: error.issues,
  };
  reply.status(400).send(body);
}

function handleFastifyClientError(error: FastifyError, reply: FastifyReply): void {
  const body: ErrorResponseBody = {
    code: error.code ?? 'BAD_REQUEST',
    message: error.message,
  };
  reply.status(error.statusCode as number).send(body);
}

function handleUnexpectedError(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);
  const body: ErrorResponseBody = { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' };
  reply.status(500).send(body);
}

export default fp(async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError | DomainError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof DomainError) {
      handleDomainError(error, reply);
      return;
    }
    if (error instanceof ZodError) {
      handleZodError(error, reply);
      return;
    }
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      handleFastifyClientError(error, reply);
      return;
    }
    handleUnexpectedError(error, request, reply);
  });
});
