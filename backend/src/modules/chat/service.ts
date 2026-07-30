import { env } from '../../config/env.js';
import { getLlmProvider, type LlmMessage } from '../llm/index.js';
import { hybridSearch, type RetrievedChunk } from '../search/retriever.js';
import { buildContext, buildUserMessage, SYSTEM_PROMPT } from './prompt.js';
import {
  ensureConversation,
  recentTurns,
  saveMessage,
  type ChatSource,
} from './repository.js';

export type ChatEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string };

export type ChatInput = {
  question: string;
  conversationId?: string;
};

function toSources(chunks: RetrievedChunk[]): ChatSource[] {
  return chunks.map((chunk, index) => ({
    index: index + 1,
    contractId: chunk.contractId,
    contractNumber: chunk.contractNumber,
    filename: chunk.filename,
    buyerName: chunk.buyerName,
    clauseNumber: chunk.clauseNumber,
    heading: chunk.heading,
    excerpt: chunk.content,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
  }));
}

function buildRetrievalQuery(question: string, history: LlmMessage[]): string {
  const lastUserTurn = [...history]
    .reverse()
    .find((message) => message.role === 'user');

  return lastUserTurn ? `${lastUserTurn.content} ${question}` : question;
}

export async function* streamAnswer(input: ChatInput): AsyncGenerator<ChatEvent> {
  const question = input.question.trim();
  const conversationId = await ensureConversation(input.conversationId, question);

  yield { type: 'conversation', conversationId };

  const stored = await recentTurns(conversationId, env.HISTORY_MAX_TURNS);
  const history: LlmMessage[] = stored.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const chunks = await hybridSearch(buildRetrievalQuery(question, history));
  const sources = toSources(chunks);

  yield { type: 'sources', sources };

  await saveMessage(conversationId, 'user', question);

  const messages: LlmMessage[] = [
    ...history,
    { role: 'user', content: buildUserMessage(question, buildContext(chunks)) },
  ];

  const llm = getLlmProvider();
  let answer = '';

  for await (const delta of llm.stream({ system: SYSTEM_PROMPT, messages })) {
    answer += delta;
    yield { type: 'delta', text: delta };
  }

  const messageId = await saveMessage(
    conversationId,
    'assistant',
    answer.trim(),
    sources,
  );

  yield { type: 'done', messageId };
}
