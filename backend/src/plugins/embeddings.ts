import fp from 'fastify-plugin';

import { warmupEmbedder } from '../modules/embeddings/embedder.js';

export const embeddingsPlugin = fp(async (app) => {
  app.log.info('carregando modelo de embeddings em segundo plano');

  void warmupEmbedder()
    .then(() => app.log.info('modelo de embeddings pronto'))
    .catch((error: unknown) =>
      app.log.error({ err: error }, 'falha ao carregar modelo de embeddings'),
    );
});
