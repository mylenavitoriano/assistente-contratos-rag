import type { Contract, HealthStatus, Message, Source } from '../types';

const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(response: Response): Promise<never> {
  let message = `Erro ${response.status}`;

  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // resposta sem corpo JSON
  }

  throw new ApiError(message, response.status);
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${BASE}/health`);
  if (!response.ok && response.status !== 503) await parseError(response);
  return (await response.json()) as HealthStatus;
}

export async function fetchContracts(): Promise<Contract[]> {
  const response = await fetch(`${BASE}/contracts`);
  if (!response.ok) await parseError(response);
  const body = (await response.json()) as { contracts: Contract[] };
  return body.contracts;
}

export async function uploadContract(file: File): Promise<Contract> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${BASE}/contracts`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) await parseError(response);
  const body = (await response.json()) as { contract: Contract };
  return body.contract;
}

export async function removeContract(id: string): Promise<void> {
  const response = await fetch(`${BASE}/contracts/${id}`, { method: 'DELETE' });
  if (!response.ok) await parseError(response);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  if (!response.ok) await parseError(response);
  const body = (await response.json()) as { messages: Message[] };
  return body.messages;
}

export type ChatHandlers = {
  onConversation: (conversationId: string) => void;
  onSources: (sources: Source[]) => void;
  onDelta: (text: string) => void;
  onDone: (messageId: string) => void;
  onError: (message: string) => void;
};

export async function streamChat(
  question: string,
  conversationId: string | null,
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversationId: conversationId ?? undefined }),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = 'Falha ao enviar a pergunta.';

    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // resposta sem corpo JSON
    }

    handlers.onError(message);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!event || !data) continue;

      const payload = JSON.parse(data) as {
        conversationId?: string;
        sources?: Source[];
        text?: string;
        messageId?: string;
        message?: string;
      };

      switch (event) {
        case 'conversation':
          if (payload.conversationId) {
            handlers.onConversation(payload.conversationId);
          }
          break;
        case 'sources':
          handlers.onSources(payload.sources ?? []);
          break;
        case 'delta':
          if (payload.text) handlers.onDelta(payload.text);
          break;
        case 'done':
          handlers.onDone(payload.messageId ?? '');
          break;
        case 'error':
          handlers.onError(payload.message ?? 'Erro ao gerar a resposta.');
          break;
      }
    }
  }
}
