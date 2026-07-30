import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { hybridSearch } from './retriever.js';

const searchQuery = z.object({
  q: z.string().trim().min(2, 'Informe ao menos 2 caracteres na busca.'),
  topK: z.coerce.number().int().min(1).max(50).optional(),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/search', async (request) => {
    const { q, topK } = searchQuery.parse(request.query);
    const results = await hybridSearch(q, { topK: topK ?? env.RETRIEVAL_TOP_K });

    return { query: q, total: results.length, results };
  });
}
