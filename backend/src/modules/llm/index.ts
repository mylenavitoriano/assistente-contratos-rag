import { env } from '../../config/env.js';
import { createGeminiProvider } from './gemini.js';
import type { LlmProvider } from './types.js';

const providers: Record<string, () => LlmProvider> = {
  gemini: createGeminiProvider,
};

let instance: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (!instance) {
    const factory = providers[env.LLM_PROVIDER];

    if (!factory) {
      throw new Error(`provedor de LLM não suportado: ${env.LLM_PROVIDER}`);
    }

    instance = factory();
  }

  return instance;
}

export type { LlmProvider, LlmMessage, LlmRequest } from './types.js';
