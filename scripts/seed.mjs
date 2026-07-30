import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:3333';
const DIR = process.env.SEED_DIR ?? 'data/contratos-exemplo';

async function aguardarBackend(limiteSegundos = 180) {
  const inicio = Date.now();

  while (Date.now() - inicio < limiteSegundos * 1000) {
    try {
      const resposta = await fetch(`${API}/api/health`);
      const saude = await resposta.json();

      if (saude.dependencies?.embedder === 'ready') return;

      process.stdout.write(
        `\raguardando o backend (${saude.dependencies?.embedder ?? '...'})`,
      );
    } catch {
      process.stdout.write('\raguardando o backend (iniciando)');
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('backend não ficou pronto a tempo');
}

async function enviar(arquivo) {
  const conteudo = await readFile(path.join(DIR, arquivo));
  const form = new FormData();
  form.append('file', new Blob([conteudo], { type: 'application/pdf' }), arquivo);

  const resposta = await fetch(`${API}/api/contracts`, {
    method: 'POST',
    body: form,
  });
  const corpo = await resposta.json();

  if (resposta.status === 201) {
    const c = corpo.contract;
    return `indexado  ${c.contractNumber ?? c.filename} · ${c.buyerName ?? '-'} · ${c.chunkCount} trechos`;
  }

  if (resposta.status === 409) return `já existia ${arquivo}`;

  return `FALHOU    ${arquivo}: ${corpo.message ?? resposta.status}`;
}

await aguardarBackend();
process.stdout.write('\r');

const arquivos = (await readdir(DIR)).filter((nome) => nome.endsWith('.pdf')).sort();

if (arquivos.length === 0) {
  console.log(`nenhum PDF encontrado em ${DIR}`);
  process.exit(0);
}

for (const arquivo of arquivos) {
  console.log(await enviar(arquivo));
}
