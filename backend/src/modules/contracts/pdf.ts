import { createRequire } from 'node:module';
import path from 'node:path';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { unprocessable } from '../../shared/errors.js';

const require = createRequire(import.meta.url);

const STANDARD_FONT_DATA_URL = `${path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
)}${path.sep}`;

export type ExtractedPdf = {
  pageCount: number;
  pages: string[];
};

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdf> {
  let document;

  try {
    document = await getDocument({
      data: new Uint8Array(data),
      useSystemFonts: false,
      disableFontFace: true,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    }).promise;
  } catch (error) {
    throw unprocessable('Não foi possível ler o PDF enviado.', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();

      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        text += item.str;
        if (item.hasEOL) text += '\n';
      }

      pages.push(normalize(text));
      page.cleanup();
    }

    const hasText = pages.some((page) => page.length > 0);

    if (!hasText) {
      throw unprocessable(
        'O PDF não contém texto extraível. Arquivos digitalizados exigem OCR.',
      );
    }

    return { pageCount: document.numPages, pages };
  } finally {
    await document.destroy();
  }
}
