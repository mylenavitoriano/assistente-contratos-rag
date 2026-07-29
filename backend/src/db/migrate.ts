import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { pool } from './pool.js';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');
const ADVISORY_LOCK_KEY = 4071982;

export type MigrationLogger = {
  info: (message: string) => void;
};

export async function runMigrations(logger: MigrationLogger): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const applied = new Set(rows.map((row) => row.name));

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      logger.info('banco já está atualizado');
      return;
    }

    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
        logger.info(`migration aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`falha na migration ${file}`, { cause: error });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    client.release();
  }
}
