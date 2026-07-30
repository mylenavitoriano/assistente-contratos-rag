import { access } from 'node:fs/promises';
import path from 'node:path';

const CANDIDATES = [
  path.resolve(import.meta.dirname, '../data/contratos-exemplo'),
  path.resolve(import.meta.dirname, '../../data/contratos-exemplo'),
];

export async function contractsDir(): Promise<string | null> {
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

export async function databaseAvailable(): Promise<boolean> {
  const { pool } = await import('../src/db/pool.js');

  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
