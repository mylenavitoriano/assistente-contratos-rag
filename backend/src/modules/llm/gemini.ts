import { GoogleGenAI } from '@google/genai';

import { env } from '../../config/env.js';
import { AppError, serviceUnavailable } from '../../shared/errors.js';
import type { LlmProvider, LlmRequest } from './types.js';

const DEFAULT_MAX_OUTPUT_TOKENS = 2048;

function toContents(request: LlmRequest) {
  return request.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

function toConfig(request: LlmRequest) {
  return {
    systemInstruction: request.system,
    temperature: request.temperature ?? env.LLM_TEMPERATURE,
    maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

function wrapError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);

  if (/api[_ ]?key|401|403|permission/i.test(message)) {
    return serviceUnavailable(
      'Chave da API do LLM inválida ou sem permissão. Verifique LLM_API_KEY.',
    );
  }

  if (/429|quota|rate/i.test(message)) {
    return serviceUnavailable(
      'Limite de requisições do LLM atingido. Tente novamente em instantes.',
    );
  }

  return serviceUnavailable('O provedor de LLM não respondeu. Tente novamente.');
}

export function createGeminiProvider(): LlmProvider {
  const apiKey = env.LLM_API_KEY.trim();
  const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const requireClient = (): GoogleGenAI => {
    if (!client) {
      throw serviceUnavailable(
        'LLM_API_KEY não configurada. Defina a chave no .env para usar o chat.',
      );
    }
    return client;
  };

  return {
    name: 'gemini',
    model: env.LLM_MODEL,

    isConfigured: () => client !== null,

    async complete(request) {
      const genai = requireClient();

      try {
        const response = await genai.models.generateContent({
          model: env.LLM_MODEL,
          contents: toContents(request),
          config: toConfig(request),
        });

        return response.text ?? '';
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw wrapError(error);
      }
    },

    async *stream(request) {
      const genai = requireClient();

      try {
        const response = await genai.models.generateContentStream({
          model: env.LLM_MODEL,
          contents: toContents(request),
          config: toConfig(request),
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) yield text;
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw wrapError(error);
      }
    },
  };
}
