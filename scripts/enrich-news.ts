import { loadEnvConfig } from '@next/env';
import { runNewsAiWorker } from '../lib/news-ai-worker';

loadEnvConfig(process.cwd());

async function main() {
  // The scheduled GitHub Action owns the news pipeline, so it also rewrites
  // scraped OFFICIAL publisher rows with the same validation gate as LATEST.
  const result = await runNewsAiWorker(undefined, { includeOfficial: true });
  console.log(JSON.stringify({ event: 'news_ai_worker_complete', ...result }));

  if (!result.configured) {
    throw new Error(`News AI worker is not configured. Missing: ${result.missing.join(', ')}`);
  }

  if (result.failed > 0) {
    throw new Error(`News AI worker failed to persist ${result.failed} article(s).`);
  }
}

main().catch((error: unknown) => {
  console.error('News AI worker failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
