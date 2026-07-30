import { pool } from '../../db/pool.js';
import { notFound } from '../../shared/errors.js';

export type ChatSource = {
  index: number;
  contractId: string;
  contractNumber: string | null;
  filename: string;
  buyerName: string | null;
  clauseNumber: number | null;
  heading: string;
  excerpt: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  createdAt: string;
};

export async function createConversation(title: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO conversations (title) VALUES ($1) RETURNING id',
    [title.slice(0, 120)],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error('falha ao criar conversa');

  return id;
}

export async function ensureConversation(
  conversationId: string | undefined,
  title: string,
): Promise<string> {
  if (!conversationId) return createConversation(title);

  const { rowCount } = await pool.query(
    'SELECT 1 FROM conversations WHERE id = $1',
    [conversationId],
  );

  if (rowCount === 0) throw notFound('Conversa não encontrada.');

  return conversationId;
}

export async function listMessages(
  conversationId: string,
  limit?: number,
): Promise<StoredMessage[]> {
  const { rows } = await pool.query<StoredMessage>(
    `SELECT id, role, content, sources, created_at AS "createdAt"
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC, id ASC
     ${limit ? 'LIMIT ' + limit : ''}`,
    [conversationId],
  );

  return rows;
}

export async function recentTurns(
  conversationId: string,
  maxTurns: number,
): Promise<StoredMessage[]> {
  if (maxTurns <= 0) return [];

  const { rows } = await pool.query<StoredMessage>(
    `SELECT id, role, content, sources, created_at AS "createdAt"
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [conversationId, maxTurns * 2],
  );

  return rows.reverse();
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  sources: ChatSource[] = [],
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO messages (conversation_id, role, content, sources)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [conversationId, role, content, JSON.stringify(sources)],
  );

  await pool.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [
    conversationId,
  ]);

  const id = rows[0]?.id;
  if (!id) throw new Error('falha ao salvar mensagem');

  return id;
}
