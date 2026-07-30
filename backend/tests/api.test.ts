import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { databaseAvailable } from './helpers.js';

const disponivel = await databaseAvailable();

describe.skipIf(!disponivel)('API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('responde o health check com o estado das dependências', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/health' });
    const corpo = resposta.json();

    expect(resposta.statusCode).toBe(200);
    expect(corpo.dependencies.database).toBe('up');
    expect(corpo.dependencies).toHaveProperty('embedder');
  });

  it('devolve 404 padronizado em rota inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json().code).toBe('NOT_FOUND');
  });

  it('lista contratos', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/contracts' });

    expect(resposta.statusCode).toBe(200);
    expect(Array.isArray(resposta.json().contracts)).toBe(true);
  });

  it('recusa upload sem arquivo', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/api/contracts' });

    expect(resposta.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('recusa conteúdo que não é PDF mesmo com mimetype forjado', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.from('isto não é um pdf')], { type: 'application/pdf' }),
      'falso.pdf',
    );

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/contracts',
      body: form,
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().message).toMatch(/não é um PDF válido/i);
  });

  it('rejeita identificador malformado sem expor o schema interno', async () => {
    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/contracts/nao-e-uuid',
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().details).toEqual([
      { field: 'id', message: 'Identificador de contrato inválido.' },
    ]);
  });

  it('devolve 404 ao excluir contrato inexistente', async () => {
    const resposta = await app.inject({
      method: 'DELETE',
      url: '/api/contracts/00000000-0000-4000-8000-000000000000',
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('valida a pergunta enviada ao chat', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { question: 'oi' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().code).toBe('VALIDATION_ERROR');
  });

  it('valida os parâmetros da busca', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/search?q=a' });

    expect(resposta.statusCode).toBe(400);
  });
});
