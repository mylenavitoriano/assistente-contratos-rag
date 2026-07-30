# Assistente de Contratos — Área Incrível

Sistema RAG para consulta em linguagem natural sobre contratos de compra e venda
de imóveis. Faz upload de PDFs, indexa por cláusula em um banco vetorial e
responde perguntas citando o trecho exato e o contrato de origem — ou diz
claramente que a informação não existe.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 22 · TypeScript · Fastify 5 |
| Banco | PostgreSQL 17 + pgvector |
| Embeddings | Transformers.js · `multilingual-e5-small` (local, sem API key) |
| LLM | Google Gemini (configurável por variável de ambiente) |
| Frontend | React 18 · TypeScript · Vite · nginx |
| Orquestração | Docker Compose |

> O enunciado pedia Python/FastAPI e `sentence-transformers`. A stack foi
> adaptada para Node.js a pedido, mantendo o requisito essencial: o modelo de
> embeddings roda **localmente dentro do container, sem API key**.

---

## Como rodar

### O que você precisa

- **Docker** e **Docker Compose** (Docker Desktop no Windows/macOS)
- Uma **chave de API do Google Gemini** — gratuita em
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Portas livres: **8080** (interface), **3333** (API), **5432** (banco)
- **Conexão com a internet no primeiro boot** — o modelo de embeddings
  (~120 MB) é baixado uma vez e fica em volume Docker

Não é necessário ter Node.js, Python ou Postgres instalados na máquina.

### Passo a passo

```bash
git clone https://github.com/mylenavitoriano/assistente-contratos-rag.git
cd assistente-contratos-rag
cp .env.example .env
```

Abra o `.env` e preencha a única variável obrigatória:

```
LLM_API_KEY=sua_chave_do_gemini_aqui
```

Suba tudo:

```bash
docker compose up
```

Abra **http://localhost:8080**.

No primeiro boot o backend baixa o modelo de embeddings — leva de 30 a 60
segundos. A interface mostra *"Carregando modelo de busca"* no rodapé da barra
lateral e libera o campo de perguntas sozinha quando fica pronto.

### Carregar os contratos de exemplo (opcional)

O sistema sobe vazio. Você pode arrastar PDFs pela interface ou popular os cinco
contratos de exemplo de uma vez:

```bash
node scripts/seed.mjs
```

---

## Como usar

1. **Adicione contratos** — arraste um PDF para a área na barra lateral. O
   sistema extrai o texto, divide por cláusula, gera os embeddings e mostra
   comprador, valor e empreendimento no card.
2. **Pergunte** — em linguagem natural, sobre um contrato específico ou sobre
   todos.
3. **Confira a fonte** — clique em *"N fontes consultadas"* abaixo de qualquer
   resposta para ver o trecho exato, a cláusula e a página de origem.
4. **Continue a conversa** — perguntas de acompanhamento mantêm o contexto
   ("e qual a garantia *dela*?").

---

## Decisões técnicas

### Chunking por cláusula, não por contagem de tokens

Contratos de compra e venda têm estrutura previsível (`CLÁUSULA 7 — DO
DISTRATO`). Cada cláusula vira um chunk, com número, título e páginas de origem
como metadados — o que torna a citação da fonte precisa em vez de um trecho
solto.

Três detalhes que só apareceram com os PDFs reais:

- **Páginas são concatenadas antes do corte.** A Cláusula 9 de um dos contratos
  atravessa a quebra de página; cortar por página partiria o chunk no meio.
- **O cabeçalho é ancorado a início de linha.** Uma primeira versão confundia
  a referência inline *"previsto na Cláusula 5"* com um cabeçalho de cláusula.
- **Linhas quebradas pela diagramação são remontadas**, preservando marcadores
  de lista e rótulos em caixa alta.

PDFs fora desse padrão caem em chunking por tamanho com sobreposição.

### Cada chunk carrega o contexto do contrato

Este foi o ajuste com maior impacto no retrieval. O nome do comprador está na
Cláusula 1, mas a multa está na Cláusula 7 — chunks diferentes. Perguntar
*"qual a multa por distrato da Maria Fernanda?"* com indexação ingênua **não
encontra nada**.

Cada chunk é indexado com um cabeçalho de contexto
(`Contrato CVV-2023-0201 — Comprador: Maria Fernanda Santos — Empreendimento:
…`). Medido nos contratos de exemplo: **com contexto, a busca retorna a cláusula
correta; sem contexto, retorna zero resultados.**

### Busca híbrida com três rankers

O RRF funde **três** rankings, não dois:

| Ranker | Função |
|--------|--------|
| Vetorial (HNSW, cosseno) | similaridade semântica |
| Lexical **estrito** (`AND`) | precisão em número de contrato e nome próprio |
| Lexical **amplo** (`OR`) | cobertura em perguntas longas |

O caminho até aqui foi empírico. Só com o ranker estrito, a busca lexical
retornava **zero** em perguntas completas — `websearch_to_tsquery` exige todos os
termos no mesmo chunk. Só com o amplo, o número do contrato virava "mais um
termo" e trazia o contrato errado. Os dois juntos resolvem: quando a pergunta
cita `CVV-2024-0312`, o ranker estrito dispara e o score sobe **53%** acima do
segundo colocado.

Resultado medido nas perguntas de exemplo do desafio mais variações:
**6/7 de acerto no primeiro resultado, 7/7 entre os três primeiros.**

A API expõe o ranking de cada sinal (`semanticRank`, `exactRank`,
`lexicalRank`), o que torna o resultado auditável em vez de um score opaco.

### Busca insensível a acento

O Postgres recebe uma configuração de busca própria (`pt_unaccent` =
`portuguese` + `unaccent`). Buscar `tolerancia impermeabilizacao` encontra
"tolerância" e "impermeabilização". Ninguém digita acento em caixa de busca.

### Modelo de embeddings

O enunciado sugeria `paraphrase-multilingual-MiniLM-L12-v2`. Testando com
cláusulas reais, ele **errava uma das perguntas de exemplo do próprio desafio**
("garantia de impermeabilização" rankeava a cláusula de distrato em primeiro).

Adotado o `multilingual-e5-small`: mesmas 384 dimensões (schema inalterado),
acerto em 6/6 no mesmo teste. Ele exige prefixos `query:`/`passage:`, expostos
como variáveis de ambiente.

### Fidelidade e ausência de alucinação

O prompt de sistema ([`prompt.ts`](backend/src/modules/chat/prompt.ts)) proíbe
qualquer conhecimento externo, exige citação numerada `[1]` e determina resposta
literal quando o dado não existe. O contexto é entregue em blocos numerados com
identificação do contrato, comprador, cláusula e página.

Perguntar *"qual o valor do condomínio mensal?"* — dado que não existe em nenhum
contrato — retorna **"Não encontrei essa informação nos contratos indexados."**

### Indexação transacional

Extração, sumarização e embeddings acontecem **antes** da transação; contrato e
chunks entram juntos ou nada entra. Não existe contrato indexado pela metade.
Duplicata é barrada por hash SHA-256 do conteúdo, não pelo nome do arquivo.

### Sumarização em camadas

Regex resolve os seis campos nos contratos no padrão — determinístico, gratuito
e instantâneo. O LLM é chamado **apenas** para campos que faltarem em PDFs fora
do formato. Sem chave configurada, a indexação segue normalmente com o que a
regex extraiu: o LLM nunca bloqueia o upload.

---

## Variáveis de ambiente

Só a `LLM_API_KEY` é obrigatória. Todas as outras têm padrão funcional.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `LLM_API_KEY` | — | **Obrigatória.** Chave do Gemini |
| `LLM_MODEL` | `gemini-3.1-flash-lite` | Modelo do provedor |
| `LLM_PROVIDER` | `gemini` | Provedor de LLM |
| `LLM_TEMPERATURE` | `0.1` | Baixa, para respostas fiéis ao texto |
| `LLM_MAX_OUTPUT_TOKENS` | `2048` | Limite de tokens da resposta |
| `LLM_THINKING_BUDGET` | `0` | Tokens de raciocínio; `-1` usa o padrão do modelo |
| `EMBEDDING_MODEL` | `Xenova/multilingual-e5-small` | Modelo local de embeddings |
| `EMBEDDING_DIMENSIONS` | `384` | Deve bater com a coluna `vector(384)` |
| `EMBEDDING_QUERY_PREFIX` | `query: ` | Prefixo exigido pelo E5 |
| `EMBEDDING_PASSAGE_PREFIX` | `passage: ` | Prefixo exigido pelo E5 |
| `RETRIEVAL_CANDIDATES` | `40` | Candidatos por ranker antes da fusão |
| `RETRIEVAL_TOP_K` | `8` | Trechos enviados ao LLM |
| `RRF_K` | `60` | Constante do Reciprocal Rank Fusion |
| `HISTORY_MAX_TURNS` | `6` | Turnos de conversa mantidos no contexto |
| `MAX_UPLOAD_SIZE_MB` | `25` | Limite por arquivo |
| `FRONTEND_PORT` | `8080` | Porta da interface |
| `BACKEND_PORT` | `3333` | Porta da API |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `contratos` | Credenciais do banco |

### Trocar a chave ou o modelo

Edite o `.env` e reinicie — **nenhum arquivo de código é alterado**:

```
LLM_API_KEY=outra_chave
LLM_MODEL=gemini-3.5-flash
```

```bash
docker compose up -d
```

Trocar de **provedor** (OpenAI, Anthropic, Ollama) exige código: criar um arquivo
implementando a interface `LlmProvider` (`complete` + `stream`) em
[`backend/src/modules/llm/`](backend/src/modules/llm/) e registrá-lo no mapa de
provedores. Nenhum outro módulo muda, porque todo o sistema consome a interface.

---

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Estado do banco e do modelo de embeddings |
| `GET` | `/api/contracts` | Lista os contratos indexados |
| `POST` | `/api/contracts` | Upload de PDF (`multipart/form-data`, campo `file`) |
| `DELETE` | `/api/contracts/:id` | Remove o contrato e seus chunks |
| `GET` | `/api/search?q=&topK=` | Busca híbrida com os rankings expostos |
| `POST` | `/api/chat` | Resposta RAG em streaming (SSE) |
| `GET` | `/api/conversations/:id/messages` | Histórico da conversa |

O `/api/chat` emite eventos SSE na ordem `conversation` → `sources` → `delta`\*
→ `done`, ou `error`.

---

## Desenvolvimento

Hot reload com o código montado no container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Verificação de tipos:

```bash
cd backend && npm run typecheck
cd frontend && npm run typecheck
```

Migrations são aplicadas automaticamente no boot, em ordem, com advisory lock e
uma transação por arquivo.

---

## Problemas comuns

**"Chave da API do LLM inválida ou sem permissão"**
Confira se a `LLM_API_KEY` está no `.env` e reinicie com `docker compose up -d`.

**Erro 404 no modelo do LLM**
O Google descontinua modelos periodicamente — foi o que aconteceu com o
`gemini-2.5-flash` durante o desenvolvimento. Liste os modelos que sua chave
acessa e troque `LLM_MODEL` no `.env`:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=SUA_CHAVE"
```

**A interface diz "Carregando modelo de busca"**
Primeiro boot baixando o modelo. Acompanhe com `docker compose logs -f backend`.

**Porta em uso**
Ajuste `FRONTEND_PORT`, `BACKEND_PORT` ou `POSTGRES_PORT` no `.env`.

**Recomeçar do zero**

```bash
docker compose down -v && docker compose up --build
```

---

## Requisitos do desafio

**Obrigatórios**

- [x] Upload de contratos em PDF pela interface web
- [x] Extração, chunking e indexação automática com metadados
- [x] Interface de chat em linguagem natural
- [x] Respostas com trecho exato e contrato de origem
- [x] Diz claramente quando a informação não existe
- [x] Listagem e exclusão de contratos
- [x] `docker compose up` sobe o sistema completo

**Diferenciais**

- [x] Busca híbrida: semântica + BM25 com Reciprocal Rank Fusion
- [x] Streaming das respostas via Server-Sent Events
- [x] Sumarização automática ao indexar (comprador, valor, prazo)
- [x] Histórico multi-turn com contexto de conversa
- [ ] Testes automatizados do backend
