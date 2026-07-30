import {
  pipeline,
  env as transformersEnv,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers';

import { env } from '../../config/env.js';

transformersEnv.cacheDir = env.MODEL_CACHE_DIR;
transformersEnv.allowLocalModels = false;

const BATCH_SIZE = 16;

export type EmbedderStatus = 'idle' | 'loading' | 'ready' | 'error';

let status: EmbedderStatus = 'idle';
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

export function getEmbedderStatus(): EmbedderStatus {
  return status;
}

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    status = 'loading';
    extractorPromise = pipeline('feature-extraction', env.EMBEDDING_MODEL, {
      dtype: 'fp32',
    }).catch((error: unknown) => {
      status = 'error';
      extractorPromise = null;
      throw error;
    });
  }

  return extractorPromise;
}

async function encode(texts: string[], prefix: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts
      .slice(start, start + BATCH_SIZE)
      .map((text) => `${prefix}${text}`);

    const output = await extractor(batch, { pooling: 'mean', normalize: true });
    vectors.push(...(output.tolist() as number[][]));
  }

  return vectors;
}

export function embedPassages(texts: string[]): Promise<number[][]> {
  return encode(texts, env.EMBEDDING_PASSAGE_PREFIX);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await encode([text], env.EMBEDDING_QUERY_PREFIX);

  if (!vector) {
    throw new Error('modelo de embeddings não retornou vetor');
  }

  return vector;
}

export async function warmupEmbedder(): Promise<void> {
  const vector = await embedQuery('contrato de compra e venda de imóvel');

  if (vector.length !== env.EMBEDDING_DIMENSIONS) {
    status = 'error';
    throw new Error(
      `dimensão do modelo (${vector.length}) difere de EMBEDDING_DIMENSIONS ` +
        `(${env.EMBEDDING_DIMENSIONS}); ajuste a variável ou a migration`,
    );
  }

  status = 'ready';
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
