import fp from 'fastify-plugin';
import type pg from 'pg';

import { runMigrations } from '../db/migrate.js';
import { pool, waitForDatabase } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

export const dbPlugin = fp(async (app) => {
  await waitForDatabase();
  app.log.info('conexão com o banco estabelecida');

  await runMigrations({ info: (message) => app.log.info(message) });

  app.decorate('db', pool);

  app.addHook('onClose', async () => {
    await pool.end();
  });
});
