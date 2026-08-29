import { loadEnvConfig } from '@next/env';
import { runNewsMediaWorker } from '../lib/news-media-worker';

loadEnvConfig(process.cwd());

async function main() {
  const result = await runNewsMediaWorker();
  console.log(JSON.stringify({ event: 'news_media_worker_complete', ...result }));

  if (!result.configured) {
    throw new Error(`News media worker is not configured. Missing: ${result.missing.join(', ')}`);
  }

  if (result.failed > 0) {
    throw new Error(`News media worker failed to persist ${result.failed} article(s).`);
  }
}

main().catch((error: unknown) => {
  console.error('News media worker failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
