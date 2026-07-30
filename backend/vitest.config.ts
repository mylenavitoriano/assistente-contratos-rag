import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/db/migrations/**'],
    },
  },
});
