import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { embedQuery, toVectorLiteral } from '../embeddings/embedder.js';

export type RetrievedChunk = {
  chunkId: string;
  contractId: string;
  filename: string;
  contractNumber: string | null;
  buyerName: string | null;
  development: string | null;
  clauseNumber: number | null;
  clauseTitle: string | null;
  heading: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  semanticRank: number | null;
  exactRank: number | null;
  lexicalRank: number | null;
  score: number;
};

export type SearchOptions = {
  topK?: number;
  candidates?: number;
};

const SEARCH_SQL = `
WITH parsed AS (
  SELECT
    NULLIF(websearch_to_tsquery('pt_unaccent', $3)::text, '')::tsquery AS strict_query,
    NULLIF(
      replace(websearch_to_tsquery('pt_unaccent', $3)::text, ' & ', ' | '),
      ''
    )::tsquery AS loose_query
),
semantic AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
  FROM chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> $1::vector
  LIMIT $2
),
exact AS (
  SELECT k.id,
         ROW_NUMBER() OVER (
           ORDER BY ts_rank_cd(k.search_vector, parsed.strict_query) DESC
         ) AS rank
  FROM chunks k, parsed
  WHERE parsed.strict_query IS NOT NULL
    AND k.search_vector @@ parsed.strict_query
  ORDER BY ts_rank_cd(k.search_vector, parsed.strict_query) DESC
  LIMIT $2
),
lexical AS (
  SELECT k.id,
         ROW_NUMBER() OVER (
           ORDER BY ts_rank_cd(k.search_vector, parsed.loose_query) DESC
         ) AS rank
  FROM chunks k, parsed
  WHERE parsed.loose_query IS NOT NULL
    AND k.search_vector @@ parsed.loose_query
  ORDER BY ts_rank_cd(k.search_vector, parsed.loose_query) DESC
  LIMIT $2
),
fused AS (
  SELECT id FROM semantic
  UNION SELECT id FROM exact
  UNION SELECT id FROM lexical
)
SELECT
  k.id                AS "chunkId",
  k.contract_id       AS "contractId",
  c.filename,
  c.contract_number   AS "contractNumber",
  c.buyer_name        AS "buyerName",
  c.development,
  k.clause_number     AS "clauseNumber",
  k.clause_title      AS "clauseTitle",
  k.heading,
  k.content,
  k.page_start        AS "pageStart",
  k.page_end          AS "pageEnd",
  s.rank::int         AS "semanticRank",
  e.rank::int         AS "exactRank",
  l.rank::int         AS "lexicalRank",
  COALESCE(1.0 / ($4 + s.rank), 0)
    + COALESCE(1.0 / ($4 + e.rank), 0)
    + COALESCE(1.0 / ($4 + l.rank), 0) AS score
FROM fused
JOIN chunks k ON k.id = fused.id
JOIN contracts c ON c.id = k.contract_id
LEFT JOIN semantic s ON s.id = fused.id
LEFT JOIN exact e ON e.id = fused.id
LEFT JOIN lexical l ON l.id = fused.id
ORDER BY score DESC, k.clause_number NULLS LAST
LIMIT $5
`;

export async function hybridSearch(
  query: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const candidates = options.candidates ?? env.RETRIEVAL_CANDIDATES;
  const topK = options.topK ?? env.RETRIEVAL_TOP_K;
  const embedding = await embedQuery(trimmed);

  const { rows } = await pool.query<RetrievedChunk & { score: string }>(
    SEARCH_SQL,
    [toVectorLiteral(embedding), candidates, trimmed, env.RRF_K, topK],
  );

  return rows.map((row) => ({ ...row, score: Number(row.score) }));
}
