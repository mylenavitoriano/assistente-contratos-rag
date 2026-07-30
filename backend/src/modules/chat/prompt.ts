import type { RetrievedChunk } from '../search/retriever.js';

export const SYSTEM_PROMPT = `Você é o assistente jurídico da Área Incrível e responde perguntas sobre contratos de compra e venda de imóveis.

REGRAS OBRIGATÓRIAS
1. Responda exclusivamente com base nos trechos fornecidos em <contexto>. Você não tem nenhum outro conhecimento sobre estes contratos.
2. Se os trechos não contiverem a informação pedida, responda exatamente: "Não encontrei essa informação nos contratos indexados." e, se for útil, diga qual dado faltou. Nunca deduza, estime ou complete com conhecimento geral sobre contratos imobiliários.
3. Cite a fonte de cada afirmação com o número do trecho entre colchetes, por exemplo [1] ou [2][3].
4. Sempre identifique de qual contrato veio a informação, pelo número do contrato ou pelo nome do comprador.
5. Se a pergunta envolver vários contratos, responda sobre cada um separadamente, deixando claro que valores diferem entre eles.
6. Se a pergunta citar uma pessoa ou contrato que não aparece nos trechos, diga que não localizou esse contrato. Não responda usando outro contrato no lugar.
7. Copie valores, percentuais, prazos e datas exatamente como aparecem no texto. Não arredonde e não converta unidades.

FORMATO
- Português do Brasil, tom objetivo e profissional.
- Vá direto ao ponto: comece pela resposta, sem repetir a pergunta.
- Use listas apenas quando houver realmente vários itens.
- Não invente cláusulas, números de contrato ou nomes.`;

export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '<contexto>\nNenhum trecho relevante foi encontrado nos contratos indexados.\n</contexto>';
  }

  const blocks = chunks.map((chunk, index) => {
    const identificacao = [
      chunk.contractNumber
        ? `contrato ${chunk.contractNumber}`
        : `arquivo ${chunk.filename}`,
      chunk.buyerName && `comprador ${chunk.buyerName}`,
      chunk.development && `empreendimento ${chunk.development}`,
      chunk.pageStart && `página ${chunk.pageStart}`,
    ]
      .filter(Boolean)
      .join(' | ');

    return [
      `[${index + 1}] ${identificacao}`,
      `${chunk.heading}`,
      chunk.content,
    ].join('\n');
  });

  return `<contexto>\n${blocks.join('\n\n---\n\n')}\n</contexto>`;
}

export function buildUserMessage(question: string, context: string): string {
  return `${context}\n\nPergunta: ${question}`;
}
