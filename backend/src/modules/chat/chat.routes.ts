import { Readable } from 'node:stream';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../../shared/errors.js';
import { listMessages } from './repository.js';
import { streamAnswer } from './service.js';

const chatBody = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Escreva uma pergunta com pelo menos 3 caracteres.')
    .max(1000, 'Pergunta muito longa.'),
  conversationId: z.uuid('Conversa inválida.').optional(),
});

const conversationParams = z.object({
  id: z.uuid('Conversa inválida.'),
});

function formatEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/conversations/:id/messages', async (request) => {
    const { id } = conversationParams.parse(request.params);
    return { messages: await listMessages(id) };
  });

  app.post('/chat', async (request, reply) => {
    const input = chatBody.parse(request.body);

    async function* events(): AsyncGenerator<string> {
      try {
        for await (const event of streamAnswer(input)) {
          switch (event.type) {
            case 'conversation':
              yield formatEvent('conversation', {
                conversationId: event.conversationId,
              });
              break;
            case 'sources':
              yield formatEvent('sources', { sources: event.sources });
              break;
            case 'delta':
              yield formatEvent('delta', { text: event.text });
              break;
            case 'done':
              yield formatEvent('done', { messageId: event.messageId });
              break;
          }
        }
      } catch (error) {
        request.log.error({ err: error }, 'falha ao responder no chat');

        yield formatEvent('error', {
          message:
            error instanceof AppError
              ? error.message
              : 'Não foi possível gerar a resposta. Tente novamente.',
        });
      }
    }

    return reply
      .header('Content-Type', 'text/event-stream; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-transform')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')
      .send(Readable.from(events()));
  });
}
