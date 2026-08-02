import { loadEnvConfig } from '@next/env';
import { runBulkImport } from '../lib/auto-updater';

loadEnvConfig(process.cwd());

function parseList(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const summary = await runBulkImport({
    regionNames: parseList(process.env.CHART_SYNC_REGIONS),
    genreSlugs: parseList(process.env.CHART_SYNC_GENRES),
    maxPagesPerCombination: parsePositiveInteger(process.env.CHART_SYNC_MAX_PAGES),
    pageLimit: parsePositiveInteger(process.env.CHART_SYNC_PAGE_LIMIT),
  });

  console.log(JSON.stringify({ event: 'soundcharts_sync_complete', ...summary }));

  if (summary.failedSongs > 0 && summary.savedSongs === 0) {
    throw new Error('Soundcharts sync fetched data but could not save any song rows.');
  }
}

main().catch((error: unknown) => {
  console.error('Soundcharts sync failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
