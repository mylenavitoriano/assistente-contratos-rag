import { useCallback, useRef, useState } from 'react';

import { streamChat } from '../api/client';
import type { Message, Source } from '../types';

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
}

export function useChat(notify: (message: string, tone: 'ok' | 'error') => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = useCallback((patch: (message: Message) => Message) => {
    setMessages((current) => {
      const last = current[current.length - 1];
      if (!last || last.role !== 'assistant') return current;
      return [...current.slice(0, -1), patch(last)];
    });
  }, []);

  const send = useCallback(
    async (question: string) => {
      const placeholderId = createId();

      setPending(true);
      setMessages((current) => [
        ...current,
        { id: createId(), role: 'user', content: question, sources: [] },
        {
          id: placeholderId,
          role: 'assistant',
          content: '',
          sources: [],
          streaming: true,
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(question, conversationRef.current, {
          onConversation: (conversationId) => {
            conversationRef.current = conversationId;
          },
          onSources: (sources: Source[]) => {
            patchLast((message) => ({ ...message, sources }));
          },
          onDelta: (text) => {
            patchLast((message) => ({
              ...message,
              content: message.content + text,
            }));
          },
          onDone: () => {
            patchLast((message) => ({ ...message, streaming: false }));
          },
          onError: (message) => {
            patchLast((current) => ({
              ...current,
              streaming: false,
              content: current.content || '',
            }));
            notify(message, 'error');
          },
        }, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          notify(
            error instanceof Error ? error.message : 'Falha na conversa.',
            'error',
          );
        }
      } finally {
        patchLast((message) => ({ ...message, streaming: false }));
        setPending(false);
        abortRef.current = null;
      }
    },
    [notify, patchLast],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationRef.current = null;
    setMessages([]);
    setPending(false);
  }, []);

  return { messages, pending, send, reset };
}
