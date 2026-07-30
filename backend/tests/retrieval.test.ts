import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppError } from '../src/shared/errors.js';
import { contractsDir, databaseAvailable } from './helpers.js';

const dir = await contractsDir();
const disponivel = await databaseAvailable();

const silencioso = { info: () => {}, warn: () => {} };

describe.skipIf(!disponivel || dir === null)('qualidade da busca híbrida', () => {
  beforeAll(async () => {
    const { runMigrations } = await import('../src/db/migrate.js');
    const { warmupEmbedder } = await import('../src/modules/embeddings/embedder.js');
    const { indexContract } = await import('../src/modules/contracts/indexer.js');

    await runMigrations({ info: () => {} });
    await warmupEmbedder();

    const arquivos = (await readdir(dir!)).filter((nome) => nome.endsWith('.pdf'));

    for (const arquivo of arquivos) {
      try {
        await indexContract(
          arquivo,
          await readFile(path.join(dir!, arquivo)),
          silencioso,
        );
      } catch (error) {
        if (!(error instanceof AppError) || error.statusCode !== 409) throw error;
      }
    }
  }, 180_000);

  afterAll(async () => {
    const { pool } = await import('../src/db/pool.js');
    await pool.end();
  });

  it('encontra a cláusula certa quando a pergunta cita o comprador', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch(
      'Qual a multa por distrato do contrato da Maria Fernanda Santos?',
    );

    expect(resultados[0]?.contractNumber).toBe('CVV-2023-0201');
    expect(resultados[0]?.clauseNumber).toBe(7);
  });

  it('encontra a cláusula certa quando a pergunta cita o número do contrato', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch(
      'Qual a garantia de impermeabilização do contrato CVV-2024-0312?',
    );

    expect(resultados[0]?.contractNumber).toBe('CVV-2024-0312');
    expect(resultados[0]?.clauseNumber).toBe(8);
  });

  it('aciona o ranker lexical estrito quando há identificador na pergunta', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch(
      'Qual a garantia de impermeabilização do contrato CVV-2024-0312?',
    );

    const primeiro = resultados[0];
    const segundo = resultados[1];

    expect(primeiro?.exactRank).toBe(1);
    expect(primeiro!.score).toBeGreaterThan(segundo!.score * 1.3);
  });

  it('funde os três rankers em vez de depender só do vetorial', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch(
      'Qual a multa por distrato do contrato da Maria Fernanda Santos?',
    );

    expect(resultados.some((item) => item.semanticRank !== null)).toBe(true);
    expect(resultados.some((item) => item.lexicalRank !== null)).toBe(true);
  });

  it('traz a cláusula de prazo para perguntas sobre tolerância', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch(
      'Quais contratos têm prazo de tolerância de 180 dias para entrega?',
    );

    expect(resultados[0]?.clauseNumber).toBe(5);
  });

  it('ignora acentuação na busca lexical', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const comAcento = await hybridSearch('garantia de impermeabilização');
    const semAcento = await hybridSearch('garantia de impermeabilizacao');

    expect(semAcento[0]?.chunkId).toBe(comAcento[0]?.chunkId);
  });

  it('devolve lista vazia para consulta em branco', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');

    expect(await hybridSearch('   ')).toEqual([]);
  });

  it('respeita o limite de resultados pedido', async () => {
    const { hybridSearch } = await import('../src/modules/search/retriever.js');
    const resultados = await hybridSearch('distrato', { topK: 3 });

    expect(resultados).toHaveLength(3);
  });
});
