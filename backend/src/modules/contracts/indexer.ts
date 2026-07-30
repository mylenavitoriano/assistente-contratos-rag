import { createHash } from 'node:crypto';

import { withTransaction } from '../../db/pool.js';
import { conflict, unprocessable } from '../../shared/errors.js';
import { embedPassages } from '../embeddings/embedder.js';
import { chunkContract } from './chunker.js';
import { extractPdfText } from './pdf.js';
import {
  findContractByHash,
  insertChunks,
  insertContract,
  type ContractRecord,
} from './repository.js';
import { buildChunkContext, summarizeContract } from './summarizer.js';

export type IndexLogger = {
  info: (payload: object, message: string) => void;
  warn: (payload: object, message: string) => void;
};

export async function indexContract(
  filename: string,
  data: Buffer,
  logger: IndexLogger,
): Promise<ContractRecord> {
  const contentHash = createHash('sha256').update(data).digest('hex');
  const existing = await findContractByHash(contentHash);

  if (existing) {
    throw conflict('Este contrato já foi indexado.', {
      contractId: existing.id,
      filename: existing.filename,
    });
  }

  const { pageCount, pages } = await extractPdfText(data);
  const metadata = await summarizeContract(pages, logger);
  const chunks = chunkContract(pages);

  if (chunks.length === 0) {
    throw unprocessable('Não foi possível dividir o contrato em trechos.');
  }

  const context = buildChunkContext(metadata);
  const embeddings = await embedPassages(
    chunks.map((chunk) => `${context}\n${chunk.heading}\n${chunk.content}`),
  );

  const record = await withTransaction(async (client) => {
    const contract = await insertContract(client, {
      filename,
      contentHash,
      sizeBytes: data.byteLength,
      pageCount,
      chunkCount: chunks.length,
      metadata,
    });

    await insertChunks(client, contract.id, context, chunks, embeddings);

    return contract;
  });

  logger.info(
    { contractId: record.id, chunks: chunks.length, pages: pageCount },
    'contrato indexado',
  );

  return record;
}
