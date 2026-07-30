export type LlmMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmRequest = {
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  complete(request: LlmRequest): Promise<string>;
  stream(request: LlmRequest): AsyncIterable<string>;
}
