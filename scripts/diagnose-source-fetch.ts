import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

/**
 * Measures what the publisher fetch actually does, so the retrieval limits can be
 * set against evidence.
 *
 *   npm run news:source-fetch -- https://decider.com/... https://www.npr.org/...
 *
 * For each URL it reports status, content type, how many bytes arrived before the
 * read stopped, the wall time, and how much readable text survived — which is the
 * difference between "the page is too big" and "the server never answered".
 */

const CAP_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;

interface Probe {
  url: string;
  status?: number;
  contentType?: string;
  bytes: number;
  truncated: boolean;
  elapsedMs: number;
  textWords: number;
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

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; MusicTopNewsBot/1.0)',
      },
    });

    if (!response.body) {
      return {
        url, status: response.status, bytes: 0, truncated: false,
        elapsedMs: Date.now() - startedAt, textWords: 0, error: 'no body',
      };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes >= CAP_BYTES) {
        truncated = true;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }

    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');

    return {
      url,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      bytes,
      truncated,
      elapsedMs: Date.now() - startedAt,
      textWords: countWords(html),
    };
  } catch (error) {
    return {
      url,
      bytes: 0,
      truncated: false,
      elapsedMs: Date.now() - startedAt,
      textWords: 0,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

async function main(): Promise<void> {
  const urls = process.argv.slice(2).filter((value) => value.startsWith('http'));
  if (urls.length === 0) throw new Error('Pass one or more article URLs to probe.');

  const results: Probe[] = [];
  for (const url of urls) results.push(await probe(url));

  console.log(JSON.stringify({ event: 'source_fetch_probe', capBytes: CAP_BYTES, timeoutMs: TIMEOUT_MS, results }, null, 2));
}

main().catch((error: unknown) => {
  console.error('Source fetch probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
