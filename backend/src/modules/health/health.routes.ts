import type { FastifyInstance } from 'fastify';

import { getEmbedderStatus } from '../embeddings/embedder.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let database: 'up' | 'down' = 'up';

    try {
      await app.db.query('SELECT 1');
    } catch (error) {
      app.log.error({ err: error }, 'health check do banco falhou');
      database = 'down';
    }

    const embedder = getEmbedderStatus();

    return reply.status(database === 'up' ? 200 : 503).send({
      status: database === 'up' ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      dependencies: { database, embedder },
    });
  });
}
