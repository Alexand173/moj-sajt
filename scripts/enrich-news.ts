import { loadEnvConfig } from '@next/env';
import { runNewsAiWorker } from '../lib/news-ai-worker';

loadEnvConfig(process.cwd());

/**
 * `--official-only` rewrites just the scraped OFFICIAL publisher rows, which is
 * the queue that feeds the official brief reader. `--limit=<n>` overrides the
 * batch size (capped at 20 by the enrichment module).
 */
function readOptions() {
  const officialOnly = process.argv.includes('--official-only');
  const limitArg = process.argv.find((argument) => argument.startsWith('--limit='));
  const parsedLimit = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : Number.NaN;

  return {
    officialOnly,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  };
}

async function main() {
  // The scheduled cron owns the news pipeline, so it also rewrites scraped
  // OFFICIAL publisher rows with the same validation gate as LATEST.
  const { officialOnly, limit } = readOptions();
  const result = await runNewsAiWorker(limit, { includeOfficial: !officialOnly, officialOnly });
  console.log(JSON.stringify({ event: 'news_ai_worker_complete', officialOnly, ...result }));

  if (!result.configured) {
    throw new Error(`News AI worker is not configured. Missing: ${result.missing.join(', ')}`);
  }

  if (result.failed > 0) {
    throw new Error(`News AI worker failed to update ${result.failed} article(s).`);
  }
}

main().catch((error: unknown) => {
  console.error('News AI worker failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
