import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';
import { badRequest, unprocessable } from '../../shared/errors.js';
import { indexContract } from './indexer.js';
import { listContracts } from './repository.js';

const PDF_MAGIC = '%PDF-';

export async function contractRoutes(app: FastifyInstance): Promise<void> {
  app.get('/contracts', async () => ({ contracts: await listContracts() }));

  app.post('/contracts', async (request, reply) => {
    const file = await request.file();

    if (!file) {
      throw badRequest('Envie um arquivo PDF no campo "file".');
    }

    if (file.mimetype !== 'application/pdf') {
      throw unprocessable(
        `Formato não suportado: ${file.mimetype}. Envie um arquivo PDF.`,
      );
    }

    const data = await file.toBuffer();

    if (file.file.truncated) {
      throw unprocessable(
        `Arquivo acima do limite de ${env.MAX_UPLOAD_SIZE_MB} MB.`,
      );
    }

    if (data.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
      throw unprocessable('O arquivo enviado não é um PDF válido.');
    }

    const contract = await indexContract(file.filename, data, {
      info: (payload, message) => request.log.info(payload, message),
      warn: (payload, message) => request.log.warn(payload, message),
    });

    return reply.status(201).send({ contract });
  });
}
