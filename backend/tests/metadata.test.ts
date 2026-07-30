import { describe, expect, it } from 'vitest';

import { extractMetadata } from '../src/modules/contracts/metadata.js';
import { buildChunkContext } from '../src/modules/contracts/summarizer.js';

const CONTRATO = [
  'GRUPO MNGT INCORPORAÇÕES LTDA.',
  'Contrato nº CVV-2024-0312',
  'CLÁUSULA 1 — DAS PARTES',
  'COMPRADOR(A): Camila Rodrigues Mendes, inscrito(a) no CPF sob nº 901.234.567-44.',
  'CLÁUSULA 2 — DO OBJETO',
  'integrante do empreendimento Condomínio Vista Verde, situado na Rua das',
  'Palmeiras, s/n, Rio Claro/SP.',
  'CLÁUSULA 3 — DO PREÇO E FORMA DE PAGAMENTO',
  'O preço total da unidade é de R$ 720.000,00, a ser pago na seguinte forma:',
  'CLÁUSULA 5 — DO PRAZO DE ENTREGA',
  'entregar a unidade no prazo de 36 meses a partir do registro da',
  'incorporação (10/01/2024), com tolerância de 180 dias.',
  'Rio Claro/SP, 05/09/2024.',
].join('\n');

describe('extractMetadata', () => {
  const metadata = extractMetadata([CONTRATO]);

  it('extrai o número do contrato', () => {
    expect(metadata.contractNumber).toBe('CVV-2024-0312');
  });

  it('extrai o comprador sem arrastar o CPF', () => {
    expect(metadata.buyerName).toBe('Camila Rodrigues Mendes');
  });

  it('extrai o empreendimento', () => {
    expect(metadata.development).toBe('Condomínio Vista Verde');
  });

  it('extrai o valor sem pontuação sobrando', () => {
    expect(metadata.totalValue).toBe('R$ 720.000,00');
  });

  it('combina prazo e tolerância', () => {
    expect(metadata.deliveryTerm).toBe('36 meses com tolerância de 180 dias');
  });

  it('pega a data de assinatura, não a do registro da incorporação', () => {
    expect(metadata.signedAt).toBe('05/09/2024');
  });

  it('devolve nulo em vez de inventar quando o texto não tem os dados', () => {
    const vazio = extractMetadata(['lorem ipsum dolor sit amet']);

    expect(Object.values(vazio).every((valor) => valor === null)).toBe(true);
  });
});

describe('buildChunkContext', () => {
  it('monta o cabeçalho que torna o chunk localizável pelo comprador', () => {
    const contexto = buildChunkContext(extractMetadata([CONTRATO]));

    expect(contexto).toBe(
      'Contrato CVV-2024-0312 — Comprador: Camila Rodrigues Mendes — Empreendimento: Condomínio Vista Verde',
    );
  });

  it('omite as partes ausentes sem deixar separador solto', () => {
    const contexto = buildChunkContext({
      contractNumber: 'CVV-2023-0147',
      buyerName: null,
      development: null,
      totalValue: null,
      deliveryTerm: null,
      signedAt: null,
    });

    expect(contexto).toBe('Contrato CVV-2023-0147');
  });
});
