import { loadEnvConfig } from '@next/env';
import { runNewsAiWorker } from '../lib/news-ai-worker';

loadEnvConfig(process.cwd());

/**
 * `--official-only` rewrites just the scraped OFFICIAL publisher rows, which is
 * the queue that feeds the official brief reader.
 *
 * `--limit=<n>`       rows per batch (capped at 20 by the enrichment module).
 * `--batches=<n>`     batches attempted by this invocation (default 10).
 * `--since-days=<n>`  lookback window in days (default 21).
 * `--concurrency=<n>` parallel rewrites per batch (default 4).
 *
 * A local run has no wall-clock limit, so the time budget is disabled here; the
 * cron route keeps the 270s guard because Vercel kills the function at 300s.
 */
function readNumberFlag(flag: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) return undefined;

  const parsed = Number.parseInt(argument.slice(flag.length + 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readOptions() {
  return {
    officialOnly: process.argv.includes('--official-only'),
    limit: readNumberFlag('--limit'),
    maxBatches: readNumberFlag('--batches'),
    sinceDays: readNumberFlag('--since-days'),
    concurrency: readNumberFlag('--concurrency'),
  };
}

async function main() {
  // The scheduled cron owns the news pipeline, so it also rewrites scraped
  // OFFICIAL publisher rows with the same validation gate as LATEST.
  const { officialOnly, limit, maxBatches, sinceDays, concurrency } = readOptions();
  const result = await runNewsAiWorker(limit, {
    includeOfficial: !officialOnly,
    officialOnly,
    maxBatches,
    sinceDays,
    concurrency,
    timeBudgetMs: Number.POSITIVE_INFINITY,
  });
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
