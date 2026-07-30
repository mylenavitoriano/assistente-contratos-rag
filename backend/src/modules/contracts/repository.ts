import { pool, type DbClient } from '../../db/pool.js';
import { toVectorLiteral } from '../embeddings/embedder.js';
import type { ContractChunk } from './chunker.js';
import type { ContractMetadata } from './metadata.js';

export type ContractRecord = {
  id: string;
  filename: string;
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  contractNumber: string | null;
  buyerName: string | null;
  development: string | null;
  totalValue: string | null;
  deliveryTerm: string | null;
  signedAt: string | null;
  createdAt: string;
};

const SELECT_COLUMNS = `
  id,
  filename,
  size_bytes      AS "sizeBytes",
  page_count      AS "pageCount",
  chunk_count     AS "chunkCount",
  contract_number AS "contractNumber",
  buyer_name      AS "buyerName",
  development,
  total_value     AS "totalValue",
  delivery_term   AS "deliveryTerm",
  signed_at       AS "signedAt",
  created_at      AS "createdAt"
`;

export async function findContractByHash(
  contentHash: string,
): Promise<ContractRecord | null> {
  const { rows } = await pool.query<ContractRecord>(
    `SELECT ${SELECT_COLUMNS} FROM contracts WHERE content_hash = $1`,
    [contentHash],
  );

  return rows[0] ?? null;
}

export async function listContracts(): Promise<ContractRecord[]> {
  const { rows } = await pool.query<ContractRecord>(
    `SELECT ${SELECT_COLUMNS} FROM contracts ORDER BY created_at DESC`,
  );

  return rows;
}

export async function insertContract(
  client: DbClient,
  input: {
    filename: string;
    contentHash: string;
    sizeBytes: number;
    pageCount: number;
    chunkCount: number;
    metadata: ContractMetadata;
  },
): Promise<ContractRecord> {
  const { rows } = await client.query<ContractRecord>(
    `INSERT INTO contracts (
       filename, content_hash, size_bytes, page_count, chunk_count,
       contract_number, buyer_name, development, total_value,
       delivery_term, signed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${SELECT_COLUMNS}`,
    [
      input.filename,
      input.contentHash,
      input.sizeBytes,
      input.pageCount,
      input.chunkCount,
      input.metadata.contractNumber,
      input.metadata.buyerName,
      input.metadata.development,
      input.metadata.totalValue,
      input.metadata.deliveryTerm,
      input.metadata.signedAt,
    ],
  );

  const record = rows[0];

  if (!record) {
    throw new Error('falha ao inserir contrato');
  }

  return record;
}

const CHUNK_COLUMNS = 11;

export async function insertChunks(
  client: DbClient,
  contractId: string,
  context: string,
  chunks: ContractChunk[],
  embeddings: number[][],
): Promise<void> {
  if (chunks.length === 0) return;

  const values: unknown[] = [];
  const placeholders = chunks.map((chunk, index) => {
    const base = index * CHUNK_COLUMNS;

    values.push(
      contractId,
      chunk.position,
      chunk.clauseNumber,
      chunk.clauseTitle,
      chunk.heading,
      chunk.content,
      context,
      chunk.pageStart,
      chunk.pageEnd,
      chunk.charCount,
      toVectorLiteral(embeddings[index] ?? []),
    );

    const slots = Array.from(
      { length: CHUNK_COLUMNS },
      (_, offset) => `$${base + offset + 1}`,
    );

    return `(${slots.slice(0, CHUNK_COLUMNS - 1).join(', ')}, ${slots[CHUNK_COLUMNS - 1]}::vector)`;
  });

  await client.query(
    `INSERT INTO chunks (
       contract_id, position, clause_number, clause_title, heading,
       content, context, page_start, page_end, char_count, embedding
     ) VALUES ${placeholders.join(', ')}`,
    values,
  );
}

export async function deleteContract(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM contracts WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
