import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { chunkContract } from '../src/modules/contracts/chunker.js';
import { extractMetadata } from '../src/modules/contracts/metadata.js';
import { extractPdfText } from '../src/modules/contracts/pdf.js';
import { contractsDir } from './helpers.js';

const dir = await contractsDir();

describe.skipIf(dir === null)('extração dos contratos de exemplo', () => {
  let arquivos: string[] = [];

  beforeAll(async () => {
    arquivos = (await readdir(dir!)).filter((nome) => nome.endsWith('.pdf')).sort();
  });

  it('encontra os PDFs de exemplo', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it('extrai texto, metadados e cláusulas de todos eles', async () => {
    for (const arquivo of arquivos) {
      const { pageCount, pages } = await extractPdfText(
        await readFile(path.join(dir!, arquivo)),
      );

      expect(pageCount, arquivo).toBeGreaterThan(0);
      expect(pages.join('').length, arquivo).toBeGreaterThan(1000);

      const metadata = extractMetadata(pages);
      expect(metadata.contractNumber, arquivo).toMatch(/^CVV-\d{4}-\d{4}$/);
      expect(metadata.buyerName, arquivo).toBeTruthy();
      expect(metadata.totalValue, arquivo).toMatch(/^R\$ [\d.,]+$/);
      expect(metadata.deliveryTerm, arquivo).toMatch(/meses com tolerância de/);

      const chunks = chunkContract(pages);
      const clausulas = [
        ...new Set(
          chunks
            .map((chunk) => chunk.clauseNumber)
            .filter((numero): numero is number => numero !== null),
        ),
      ];

      expect(clausulas, arquivo).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(chunks.every((chunk) => chunk.content.trim().length > 0), arquivo).toBe(
        true,
      );
      expect(chunks.every((chunk) => chunk.charCount <= 1800), arquivo).toBe(true);
      expect(chunks.every((chunk) => chunk.pageStart! >= 1), arquivo).toBe(true);
    }
  });

  it('rejeita arquivo que não é PDF', async () => {
    await expect(
      extractPdfText(Buffer.from('isto não é um pdf')),
    ).rejects.toThrow(/não foi possível ler o pdf/i);
  });
});
