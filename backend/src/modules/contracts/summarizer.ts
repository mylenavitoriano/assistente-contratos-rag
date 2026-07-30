import { getLlmProvider } from '../llm/index.js';
import { extractMetadata, type ContractMetadata } from './metadata.js';

const CONTEXT_CHARS = 5000;

const SYSTEM_PROMPT = `Você extrai dados cadastrais de contratos imobiliários brasileiros.
Responda SOMENTE com um objeto JSON válido, sem cercas de código e sem comentários.
Use exatamente estas chaves: contractNumber, buyerName, development, totalValue, deliveryTerm, signedAt.
Copie os valores literalmente do texto, sem reformatar.
Se um dado não estiver explícito no texto, use null. Nunca invente.`;

const FIELDS = [
  'contractNumber',
  'buyerName',
  'development',
  'totalValue',
  'deliveryTerm',
  'signedAt',
] as const satisfies readonly (keyof ContractMetadata)[];

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (/^(null|n\/a|não informado|nao informado|-)$/i.test(trimmed)) return null;
  return trimmed;
}

export type SummarizeLogger = {
  info: (payload: object, message: string) => void;
  warn: (payload: object, message: string) => void;
};

export async function summarizeContract(
  pages: string[],
  logger: SummarizeLogger,
): Promise<ContractMetadata> {
  const metadata = extractMetadata(pages);
  const missing = FIELDS.filter((field) => metadata[field] === null);

  if (missing.length === 0) return metadata;

  const llm = getLlmProvider();

  if (!llm.isConfigured()) {
    logger.warn(
      { missing },
      'campos ausentes e LLM não configurado; seguindo apenas com regex',
    );
    return metadata;
  }

  try {
    const excerpt = pages.join('\n').slice(0, CONTEXT_CHARS);
    const answer = await llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extraia os campos ${missing.join(', ')} do contrato abaixo.\n\n<contrato>\n${excerpt}\n</contrato>`,
        },
      ],
      temperature: 0,
      maxOutputTokens: 512,
    });

    const parsed = parseJsonObject(answer);

    if (!parsed) {
      logger.warn({ missing }, 'resposta do LLM não continha JSON válido');
      return metadata;
    }

    const filled = { ...metadata };
    for (const field of missing) {
      filled[field] = sanitize(parsed[field]);
    }

    logger.info(
      { missing, preenchidos: missing.filter((f) => filled[f] !== null) },
      'sumarização complementada pelo LLM',
    );

    return filled;
  } catch (error) {
    logger.warn({ err: error, missing }, 'sumarização pelo LLM falhou');
    return metadata;
  }
}

export function buildChunkContext(metadata: ContractMetadata): string {
  return [
    metadata.contractNumber && `Contrato ${metadata.contractNumber}`,
    metadata.buyerName && `Comprador: ${metadata.buyerName}`,
    metadata.development && `Empreendimento: ${metadata.development}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' — ');
}
