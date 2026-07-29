import { buildApp } from './app.js';
import { env } from './config/env.js';

async function main(): Promise<void> {
  const app = await buildApp();

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      app.log.info(`${signal} recebido, encerrando`);
      void app.close().then(() => process.exit(0));
    });
  }

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error({ err: error }, 'falha ao iniciar o servidor');
    process.exit(1);
  }
}

void main();
