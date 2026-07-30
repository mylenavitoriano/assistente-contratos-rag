import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';

import { env } from './config/env.js';
import { AppError } from './shared/errors.js';
import { dbPlugin } from './plugins/db.js';
import { embeddingsPlugin } from './plugins/embeddings.js';
import { healthRoutes } from './modules/health/health.routes.js';

const MEGABYTE = 1024 * 1024;

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: env.MAX_UPLOAD_SIZE_MB * MEGABYTE,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_SIZE_MB * MEGABYTE,
      files: 1,
    },
  });

  const errorHandler = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const fastifyError = error;

    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message, details: error.details });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Requisição inválida.',
        details: error.issues,
      });
    }

    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        code: fastifyError.code ?? 'BAD_REQUEST',
        message: fastifyError.message,
      });
    }

    request.log.error({ err: fastifyError }, 'erro não tratado');
    return reply.status(500).send({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor.',
    });
  };

  app.setErrorHandler(errorHandler);

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      code: 'NOT_FOUND',
      message: `Rota ${request.method} ${request.url} não encontrada.`,
    }),
  );

  await app.register(dbPlugin);
  await app.register(embeddingsPlugin);

  await app.register(healthRoutes, { prefix: '/api' });

  return app;
}
