import { loadEnvConfig } from '@next/env';
import {
  failureKindForStatus,
  getSourceMaxBytes,
  isRetryableSourceFailure,
  isTimeoutError,
  readResponseText,
  type SourceFailureKind,
} from '../lib/source-fetch';

loadEnvConfig(process.cwd());

/**
 * Measures what the publisher fetch actually does, so the retrieval limits are
 * set against evidence rather than guesses.
 *
 *   npm run news:source-fetch -- https://decider.com/... https://afropop.org/...
 *
 * It reads with the same reader as the ingest pipeline — the same cap, the same
 * rule that a truncated page is still parsed — so a run here predicts what
 * ingestion will do. For each URL it reports status, bytes read, whether the cap
 * or a stall ended the read, the wall time, readable words, and the failure kind
 * the pipeline would record.
 */

const TIMEOUT_MS = 15_000;

interface Probe {
  url: string;
  host: string;
  status?: number;
  contentType?: string;
  bytes: number;
  truncated: boolean;
  timedOut: boolean;
  elapsedMs: number;
  textWords: number;
  kind: SourceFailureKind | null;
  retryable: boolean;
  error?: string;
}

function countWords(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;
}

async function probe(url: string): Promise<Probe> {
  const startedAt = Date.now();
  const host = new URL(url).hostname;

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; MusicTopNewsBot/1.0)',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const statusKind = failureKindForStatus(response.status);

    if (statusKind || !response.body) {
      return {
        url, host, status: response.status, contentType, bytes: 0, truncated: false,
        timedOut: false, elapsedMs: Date.now() - startedAt, textWords: 0,
        kind: statusKind ?? 'invalid',
        retryable: statusKind ? isRetryableSourceFailure(statusKind) : false,
        error: response.body ? undefined : 'no body',
      };
    }

    const result = await readResponseText(response, { maxBytes: getSourceMaxBytes() });

    return {
      url,
      host,
      status: response.status,
      contentType,
      bytes: result.bytesRead,
      truncated: result.truncated,
      timedOut: result.timedOut,
      elapsedMs: Date.now() - startedAt,
      textWords: countWords(result.text),
      kind: null,
      retryable: false,
    };
  } catch (error) {
    // The request itself rejected, so no headers ever arrived.
    const timeout = isTimeoutError(error);
    return {
      url,
      host,
      bytes: 0,
      contentType: undefined,
      truncated: false,
      timedOut: timeout,
      elapsedMs: Date.now() - startedAt,
      textWords: 0,
      kind: timeout ? 'host-blocked' : 'transient',
      retryable: !timeout,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2).filter((value) => value.startsWith('http'));
  if (urls.length === 0) throw new Error('Pass one or more article URLs to probe.');

  const capBytes = getSourceMaxBytes();
  const results: Probe[] = [];
  for (const url of urls) results.push(await probe(url));

  console.log(JSON.stringify({ event: 'source_fetch_probe', capBytes, timeoutMs: TIMEOUT_MS, results }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Source fetch probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
