import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  EMBEDDING_MODEL: z.string().default('Xenova/multilingual-e5-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(384),
  EMBEDDING_QUERY_PREFIX: z.string().default('query: '),
  EMBEDDING_PASSAGE_PREFIX: z.string().default('passage: '),
  MODEL_CACHE_DIR: z.string().default('/app/.model-cache'),

  LLM_PROVIDER: z.enum(['gemini']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-2.5-flash'),
  LLM_API_KEY: z.string().default(''),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(25),
  RETRIEVAL_CANDIDATES: z.coerce.number().int().positive().default(40),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(8),
  RRF_K: z.coerce.number().int().positive().default(60),
  HISTORY_MAX_TURNS: z.coerce.number().int().nonnegative().default(6),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
