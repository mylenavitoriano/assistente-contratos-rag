const CLAUSE_HEADING =
  /^CL[ÁA]USULA\s+(\d{1,2})\s*[—–-]\s*(.+?)\s*$/gim;

const STRUCTURAL_LINE =
  /^(?:[•·]|[a-z]\)\s|\d{1,2}\.\d{1,2}\.?\s|[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ\s()/-]{2,}:)/;

const PREAMBLE_HEADING = 'Identificação do contrato';
const MAX_CHUNK_CHARS = 1800;
const CHUNK_OVERLAP_CHARS = 200;
const PACK_LIMIT = MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS;
const MIN_PREAMBLE_CHARS = 10;

export type ContractChunk = {
  position: number;
  clauseNumber: number | null;
  clauseTitle: string | null;
  heading: string;
  content: string;
  pageStart: number;
  pageEnd: number;
  charCount: number;
};

type Section = {
  clauseNumber: number | null;
  clauseTitle: string | null;
  heading: string;
  start: number;
  end: number;
};

export function joinWrappedLines(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      if (output.length > 0) output.push('');
      continue;
    }

    const previous = output[output.length - 1];

    if (previous === undefined || previous === '' || STRUCTURAL_LINE.test(line)) {
      output.push(line);
      continue;
    }

    output[output.length - 1] = `${previous} ${line}`;
  }

  return output.join('\n').trim();
}

function joinPages(pages: string[]): { text: string; pageStarts: number[] } {
  const pageStarts: number[] = [];
  let text = '';

  for (const page of pages) {
    if (text.length > 0) text += '\n';
    pageStarts.push(text.length);
    text += page;
  }

  return { text, pageStarts };
}

function pageAt(pageStarts: number[], offset: number): number {
  let page = 1;

  for (let index = 0; index < pageStarts.length; index += 1) {
    if ((pageStarts[index] ?? 0) <= offset) page = index + 1;
    else break;
  }

  return page;
}

function findSections(text: string): Section[] {
  const headings = [...text.matchAll(CLAUSE_HEADING)];

  if (headings.length === 0) return [];

  const sections: Section[] = [];
  const firstStart = headings[0]?.index ?? 0;

  if (firstStart >= MIN_PREAMBLE_CHARS) {
    sections.push({
      clauseNumber: null,
      clauseTitle: null,
      heading: PREAMBLE_HEADING,
      start: 0,
      end: firstStart,
    });
  }

  headings.forEach((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? text.length;
    const number = Number.parseInt(heading[1] ?? '', 10);
    const title = (heading[2] ?? '').trim();

    sections.push({
      clauseNumber: Number.isNaN(number) ? null : number,
      clauseTitle: title || null,
      heading: heading[0]?.trim() ?? title,
      start,
      end,
    });
  });

  return sections;
}

function overlapPrefix(previous: string | undefined, piece: string): string {
  if (!previous) return piece;

  const room = MAX_CHUNK_CHARS - piece.length - 1;
  if (room <= 0) return piece;

  const tail = previous.slice(-Math.min(CHUNK_OVERLAP_CHARS, room));
  const cut = tail.indexOf(' ');
  const prefix = cut === -1 ? '' : tail.slice(cut + 1).trim();

  return prefix.length > 0 ? `${prefix} ${piece}` : piece;
}

function splitOversized(content: string): string[] {
  if (content.length <= MAX_CHUNK_CHARS) return [content];

  const pieces = content.split('\n').flatMap(hardSplit);
  const parts: string[] = [];
  let current = '';

  for (const piece of pieces) {
    const candidate = current.length > 0 ? `${current}\n${piece}` : piece;

    if (candidate.length <= PACK_LIMIT) {
      current = candidate;
      continue;
    }

    if (current.length > 0) parts.push(current);
    current = overlapPrefix(parts[parts.length - 1], piece);
  }

  if (current.trim().length > 0) parts.push(current);

  return parts;
}

function hardSplit(block: string): string[] {
  if (block.length <= PACK_LIMIT) return [block];

  const pieces: string[] = [];
  let current = '';

  for (const sentence of block.split(/(?<=\.)\s+/)) {
    for (const fragment of sliceToLimit(sentence)) {
      if (current.length + fragment.length + 1 > PACK_LIMIT && current) {
        pieces.push(current.trim());
        current = '';
      }
      current += current.length > 0 ? ` ${fragment}` : fragment;
    }
  }

  if (current.trim()) pieces.push(current.trim());

  return pieces;
}

function sliceToLimit(sentence: string): string[] {
  if (sentence.length <= PACK_LIMIT) return [sentence];

  const fragments: string[] = [];
  for (let start = 0; start < sentence.length; start += PACK_LIMIT) {
    fragments.push(sentence.slice(start, start + PACK_LIMIT));
  }

  return fragments;
}

function fallbackSections(text: string): Section[] {
  const sections: Section[] = [];
  const step = MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS;

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + MAX_CHUNK_CHARS, text.length);

    sections.push({
      clauseNumber: null,
      clauseTitle: null,
      heading: `Trecho ${sections.length + 1}`,
      start,
      end,
    });

    if (end === text.length) break;
  }

  return sections;
}

export function chunkContract(pages: string[]): ContractChunk[] {
  const { text, pageStarts } = joinPages(pages);
  const structural = findSections(text);
  const sections = structural.length > 0 ? structural : fallbackSections(text);
  const chunks: ContractChunk[] = [];

  for (const section of sections) {
    const raw = text.slice(section.start, section.end);
    const withoutHeading =
      section.clauseNumber === null
        ? raw
        : raw.slice(raw.indexOf('\n') + 1 || raw.length);

    const content = joinWrappedLines(withoutHeading);

    if (content.length === 0) continue;

    for (const part of splitOversized(content)) {
      chunks.push({
        position: chunks.length,
        clauseNumber: section.clauseNumber,
        clauseTitle: section.clauseTitle,
        heading: section.heading,
        content: part,
        pageStart: pageAt(pageStarts, section.start),
        pageEnd: pageAt(pageStarts, Math.max(section.start, section.end - 1)),
        charCount: part.length,
      });
    }
  }

  return chunks;
}
