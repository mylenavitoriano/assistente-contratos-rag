process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL ??=
  'postgres://contratos:contratos@localhost:5432/contratos';
process.env.MODEL_CACHE_DIR ??= '/app/.model-cache';
