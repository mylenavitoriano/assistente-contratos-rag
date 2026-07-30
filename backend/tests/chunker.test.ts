import { describe, expect, it } from 'vitest';

import { chunkContract, joinWrappedLines } from '../src/modules/contracts/chunker.js';

const PAGINA_1 = [
  'GRUPO MNGT INCORPORAÇÕES LTDA.',
  'Contrato nº CVV-2024-0312',
  'CLÁUSULA 1 — DAS PARTES',
  'VENDEDORA: Grupo MNGT Incorporações Ltda., pessoa jurídica de direito privado,',
  'inscrita no CNPJ sob nº 12.345.678/0001-99.',
  'COMPRADOR(A): Camila Rodrigues Mendes, inscrito(a) no CPF sob nº 901.234.567-44.',
  'CLÁUSULA 2 — DO OBJETO',
  'A VENDEDORA compromete-se a vender a unidade autônoma integrante do',
  'empreendimento Condomínio Vista Verde, situado em Rio Claro/SP.',
].join('\n');

const PAGINA_2 = [
  'CLÁUSULA 6 — DAS PENALIDADES POR ATRASO',
  '6.1. Atraso da VENDEDORA: Ultrapassado o prazo de tolerância previsto na Cláusula 5,',
  'a VENDEDORA pagará 1% ao mês sobre o valor já pago.',
  'CLÁUSULA 7 — DO DISTRATO',
  'Em caso de rescisão contratual aplicar-se-á 20% sobre o valor total do contrato.',
  'CLÁUSULA 9 — DO MEMORIAL DESCRITIVO',
  'A unidade será entregue com os seguintes acabamentos:',
].join('\n');

const PAGINA_3 = [
  'Piso dos quartos: porcelanato retificado 90x90cm cor bege claro importado.',
  'Bancada da cozinha: mármore Carrara branco.',
].join('\n');

describe('chunkContract', () => {
  const chunks = chunkContract([PAGINA_1, PAGINA_2, PAGINA_3]);

  it('separa uma cláusula por chunk, preservando número e título', () => {
    const clausulas = chunks
      .filter((chunk) => chunk.clauseNumber !== null)
      .map((chunk) => [chunk.clauseNumber, chunk.clauseTitle]);

    expect(clausulas).toEqual([
      [1, 'DAS PARTES'],
      [2, 'DO OBJETO'],
      [6, 'DAS PENALIDADES POR ATRASO'],
      [7, 'DO DISTRATO'],
      [9, 'DO MEMORIAL DESCRITIVO'],
    ]);
  });

  it('mantém o preâmbulo com o número do contrato como primeiro chunk', () => {
    const preambulo = chunks[0];

    expect(preambulo?.clauseNumber).toBeNull();
    expect(preambulo?.content).toContain('CVV-2024-0312');
  });

  it('não confunde referência inline com cabeçalho de cláusula', () => {
    const penalidades = chunks.find((chunk) => chunk.clauseNumber === 6);

    expect(penalidades?.content).toContain('previsto na Cláusula 5');
    expect(chunks.some((chunk) => chunk.clauseNumber === 5)).toBe(false);
  });

  it('reconstrói cláusula que atravessa a quebra de página', () => {
    const memorial = chunks.find((chunk) => chunk.clauseNumber === 9);

    expect(memorial?.pageStart).toBe(2);
    expect(memorial?.pageEnd).toBe(3);
    expect(memorial?.content).toContain('porcelanato retificado');
    expect(memorial?.content).toContain('mármore Carrara');
  });

  it('registra as páginas de origem de cada chunk', () => {
    const partes = chunks.find((chunk) => chunk.clauseNumber === 1);
    const distrato = chunks.find((chunk) => chunk.clauseNumber === 7);

    expect(partes?.pageStart).toBe(1);
    expect(distrato?.pageStart).toBe(2);
  });

  it('numera as posições em sequência, sem buracos', () => {
    expect(chunks.map((chunk) => chunk.position)).toEqual(
      chunks.map((_, index) => index),
    );
  });
});

describe('chunkContract com documentos fora do padrão', () => {
  it('divide por tamanho quando não há cláusulas numeradas', () => {
    const texto = 'Memorando interno sobre procedimentos administrativos. '.repeat(120);
    const chunks = chunkContract([texto]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.clauseNumber === null)).toBe(true);
    expect(chunks.every((chunk) => chunk.charCount <= 1800)).toBe(true);
  });

  it('respeita o limite de tamanho ao dividir cláusula longa', () => {
    const longa = [
      'CLÁUSULA 1 — DO MEMORIAL',
      'Especificação técnica detalhada do acabamento. '.repeat(150),
    ].join('\n');

    const partes = chunkContract([longa]).filter(
      (chunk) => chunk.clauseNumber === 1,
    );

    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((chunk) => chunk.charCount <= 1800)).toBe(true);
    expect(partes.every((chunk) => chunk.clauseTitle === 'DO MEMORIAL')).toBe(true);
  });

  it('sobrepõe o final de uma parte no início da seguinte', () => {
    const longa = [
      'CLÁUSULA 1 — DO MEMORIAL',
      'Especificação técnica detalhada do acabamento. '.repeat(150),
    ].join('\n');

    const partes = chunkContract([longa]).filter(
      (chunk) => chunk.clauseNumber === 1,
    );

    const anterior = partes[0]?.content ?? '';
    const seguinte = partes[1]?.content ?? '';

    let sobreposicao = 0;
    for (let n = Math.min(300, anterior.length, seguinte.length); n > 0; n -= 1) {
      if (anterior.endsWith(seguinte.slice(0, n))) {
        sobreposicao = n;
        break;
      }
    }

    expect(sobreposicao).toBeGreaterThan(0);
  });

  it('não gera chunks para entrada vazia', () => {
    expect(chunkContract([''])).toHaveLength(0);
    expect(chunkContract(['   \n  \n '])).toHaveLength(0);
  });
});

describe('joinWrappedLines', () => {
  it('junta linhas quebradas pela diagramação', () => {
    const resultado = joinWrappedLines(
      'A VENDEDORA compromete-se a entregar a unidade no prazo\nde 36 meses.',
    );

    expect(resultado).toBe(
      'A VENDEDORA compromete-se a entregar a unidade no prazo de 36 meses.',
    );
  });

  it('preserva quebras estruturais de listas e rótulos', () => {
    const resultado = joinWrappedLines(
      ['Garantias oferecidas:', '• Estrutura: 5 anos.', '• Acabamentos: 2 anos.'].join(
        '\n',
      ),
    );

    expect(resultado.split('\n')).toHaveLength(3);
  });

  it('não junta CPF com a linha anterior por engano', () => {
    const resultado = joinWrappedLines(
      'VENDEDORA: Grupo MNGT.\nCOMPRADOR(A): Camila Rodrigues Mendes.',
    );

    expect(resultado.split('\n')).toHaveLength(2);
  });
});
