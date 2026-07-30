import { joinWrappedLines } from './chunker.js';

export type ContractMetadata = {
  contractNumber: string | null;
  buyerName: string | null;
  development: string | null;
  totalValue: string | null;
  deliveryTerm: string | null;
  signedAt: string | null;
};

const PATTERNS = {
  contractNumber: /Contrato\s+n[º°o]?\s*([A-Z]{2,5}-\d{4}-\d{3,5})/i,
  buyerName: /COMPRADOR\(A\)\s*:\s*([^,;]{3,80}?)\s*,\s*inscrit/i,
  development: /empreendimento\s+(.{3,80}?)\s*,\s*situad[oa]/i,
  totalValue:
    /pre[çc]o\s+total\s+da\s+unidade\s+[ée]\s+de\s+(R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i,
} as const;

const SIGNED_AT = /\/[A-Z]{2}\s*,\s*(\d{2}\/\d{2}\/\d{4})/g;

const DELIVERY_TERM =
  /prazo\s+de\s+(\d{1,3}\s*meses)[\s\S]{0,120}?tolerância\s+de\s+(\d{1,3}\s*dias)/i;

function firstMatch(text: string, pattern: RegExp): string | null {
  const value = pattern.exec(text)?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function lastSignatureDate(text: string): string | null {
  const matches = [...text.matchAll(SIGNED_AT)];
  return matches[matches.length - 1]?.[1] ?? null;
}

export function extractMetadata(pages: string[]): ContractMetadata {
  const text = joinWrappedLines(pages.join('\n'));
  const delivery = DELIVERY_TERM.exec(text);

  return {
    contractNumber: firstMatch(text, PATTERNS.contractNumber),
    buyerName: firstMatch(text, PATTERNS.buyerName),
    development: firstMatch(text, PATTERNS.development),
    totalValue: firstMatch(text, PATTERNS.totalValue),
    deliveryTerm: delivery
      ? `${delivery[1]?.trim()} com tolerância de ${delivery[2]?.trim()}`
      : null,
    signedAt: lastSignatureDate(text),
  };
}
