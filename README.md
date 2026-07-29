# Área Incrível — Assistente de Contratos

Sistema RAG para consulta em linguagem natural sobre contratos de compra e venda
de imóveis. Faz upload de PDFs, indexa por cláusula em um banco vetorial e
responde perguntas citando o trecho exato e o contrato de origem.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 22 · TypeScript · Fastify |
| Banco | PostgreSQL 16 + pgvector |
| Embeddings | Transformers.js · `paraphrase-multilingual-MiniLM-L12-v2` (local) |
| LLM | Google Gemini |
| Frontend | React 18 · TypeScript · Vite |
| Orquestração | Docker Compose |

## Execução

Documentação completa de execução, variáveis de ambiente e decisões técnicas
será consolidada aqui ao final da implementação.

```bash
cp .env.example .env
docker compose up
```
