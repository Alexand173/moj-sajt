import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dnsLookup = vi.hoisted(() => vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]));

vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

import { fetchNewsSourceText, generateAiNewsArticle } from '@/lib/ai-news';
import {
  DEFAULT_SOURCE_MAX_BYTES,
  failureKindForStatus,
  getSourceMaxBytes,
  isRetryableSourceFailure,
  isRewriteDeniedHost,
  isRewriteDeniedSourceUrl,
  readResponseText,
  SourceHostCircuit,
  sourceHostCircuit,
} from '@/lib/source-fetch';

/**
 * The two hosts that kept producing fallback briefs failed for opposite reasons:
 * npr.org returned zero bytes in 15 s (a stall, not a slow page) and decider.com
 * returned 2 MB in 214 ms (killed by our own cap). These tests pin the three
 * behaviours that follow from that: a capped read still produces a document, a
 * stall is told apart from a refusal, and a host that has already refused is not
 * fetched again in the same run.
 */

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/** A body that arrives in chunks, optionally dying mid-flight like a stall. */
function streamingResponse(chunks: string[], failAt?: number): Response {
  const encoder = new TextEncoder();
  let index = 0;

  return new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (failAt !== undefined && index === failAt) {
        controller.error(Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' }));
        return;
      }

      if (index >= chunks.length) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  }));
}

const paragraphs = (count: number, wordsEach: number): string =>
  Array.from({ length: count }, (_, index) =>
    Array.from({ length: wordsEach }, (_, word) => `word${index}x${word}`).join(' '),
  ).map((paragraph) => `<p>${paragraph}</p>`).join('');

describe('failure classification', () => {
  it('treats a usable status as no failure', () => {
    expect(failureKindForStatus(200)).toBeNull();
    expect(failureKindForStatus(204)).toBeNull();
  });

  it('separates a refusal from a retryable fault', () => {
    expect(failureKindForStatus(403)).toBe('host-refused');
    expect(failureKindForStatus(429)).toBe('host-refused');
    expect(failureKindForStatus(500)).toBe('transient');
    expect(failureKindForStatus(408)).toBe('transient');
    expect(failureKindForStatus(404)).toBe('invalid');
  });

  it('retries only the kinds that can plausibly answer differently', () => {
    expect(isRetryableSourceFailure('transient')).toBe(true);
    expect(isRetryableSourceFailure('stalled')).toBe(true);
    expect(isRetryableSourceFailure('host-blocked')).toBe(false);
    expect(isRetryableSourceFailure('host-refused')).toBe(false);
    expect(isRetryableSourceFailure('invalid')).toBe(false);
  });
});

describe('capped read', () => {
  const originalMax = process.env.AI_NEWS_SOURCE_MAX_BYTES;

  afterEach(() => {
    if (originalMax === undefined) delete process.env.AI_NEWS_SOURCE_MAX_BYTES;
    else process.env.AI_NEWS_SOURCE_MAX_BYTES = originalMax;
  });

  it('keeps the page instead of throwing at the cap', async () => {
    const result = await readResponseText(
      streamingResponse(['abcdef', 'ghijkl', 'mnopqr']),
      { maxBytes: 10 },
    );

    expect(result.truncated).toBe(true);
    expect(result.text).toBe('abcdefghij');
    // Bytes pulled from the stream, including the chunk that crossed the cap —
    // this is the number the fetch log reports, so it stays honest.
    expect(result.bytesRead).toBe(12);
  });

  it('keeps what arrived when the body stalls mid-flight', async () => {
    const result = await readResponseText(streamingResponse(['abcdef', 'ghijkl'], 2));

    expect(result.timedOut).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe('abcdefghijkl');
  });

  it('still fails when the body stalls before any byte arrives', async () => {
    await expect(readResponseText(streamingResponse(['never'], 0))).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('clamps the configured cap', () => {
    process.env.AI_NEWS_SOURCE_MAX_BYTES = '10';
    expect(getSourceMaxBytes()).toBe(512_000);

    process.env.AI_NEWS_SOURCE_MAX_BYTES = '999999999';
    expect(getSourceMaxBytes()).toBe(16_000_000);

    delete process.env.AI_NEWS_SOURCE_MAX_BYTES;
    expect(getSourceMaxBytes()).toBe(DEFAULT_SOURCE_MAX_BYTES);
  });
});

describe('rewrite denylist', () => {
  const originalDeny = process.env.SOURCE_REWRITE_DENY_HOSTS;

  afterEach(() => {
    if (originalDeny === undefined) delete process.env.SOURCE_REWRITE_DENY_HOSTS;
    else process.env.SOURCE_REWRITE_DENY_HOSTS = originalDeny;
  });

  it('matches a host and its subdomains, never a substring', () => {
    expect(isRewriteDeniedHost('npr.org')).toBe(true);
    expect(isRewriteDeniedHost('www.npr.org')).toBe(true);
    expect(isRewriteDeniedHost('npr.org.')).toBe(true);
    // The failures this guards against: a lookalike domain and a hyphenated one.
    expect(isRewriteDeniedHost('npr.org.evil.example')).toBe(false);
    expect(isRewriteDeniedHost('my-npr.org')).toBe(false);
    expect(isRewriteDeniedHost('decider.com')).toBe(false);
  });

  it('readable from a stored URL as well as a hostname', () => {
    expect(isRewriteDeniedSourceUrl('https://www.npr.org/2026/11/10/g-s1-152641/story')).toBe(true);
    expect(isRewriteDeniedSourceUrl('https://decider.com/2026/11/10/story')).toBe(false);
    expect(isRewriteDeniedSourceUrl('not a url')).toBe(false);
    expect(isRewriteDeniedSourceUrl(null)).toBe(false);
  });

  it('extends the list from configuration and can be emptied entirely', () => {
    process.env.SOURCE_REWRITE_DENY_HOSTS = 'example.com, evil.example';
    expect(isRewriteDeniedHost('www.example.com')).toBe(true);
    expect(isRewriteDeniedHost('deep.evil.example')).toBe(true);
    // Extending must not drop the measured default.
    expect(isRewriteDeniedHost('npr.org')).toBe(true);

    process.env.SOURCE_REWRITE_DENY_HOSTS = 'none';
    expect(isRewriteDeniedHost('npr.org')).toBe(false);
  });
});

describe('host circuit', () => {
  it('opens on the first blocked or refused host', () => {
    const circuit = new SourceHostCircuit();

    circuit.recordFailure('npr.org', 'host-blocked');

    expect(circuit.shouldSkip('npr.org')).toMatchObject({ skip: true });
    expect(circuit.shouldSkip('NPR.org')).toMatchObject({ skip: true });
    expect(circuit.shouldSkip('pitchfork.com')).toEqual({ skip: false });
  });

  it('gives a merely flaky host two chances', () => {
    const circuit = new SourceHostCircuit();

    circuit.recordFailure('decider.com', 'transient');
    expect(circuit.shouldSkip('decider.com')).toEqual({ skip: false });

    circuit.recordFailure('decider.com', 'transient');
    expect(circuit.shouldSkip('decider.com')).toMatchObject({ skip: true });
  });

  it('forgets a host once it answers properly', () => {
    const circuit = new SourceHostCircuit();

    circuit.recordFailure('decider.com', 'transient');
    circuit.recordSuccess('decider.com');

    expect(circuit.shouldSkip('decider.com')).toEqual({ skip: false });
  });
});

describe('fetchNewsSourceText', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sourceHostCircuit.reset();
    dnsLookup.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sourceHostCircuit.reset();
  });

  it('does not re-request a host that refused the first time', async () => {
    fetchMock.mockResolvedValue(htmlResponse('forbidden', 403));

    const first = await fetchNewsSourceText('https://decider.com/story');
    const second = await fetchNewsSourceText('https://decider.com/another-story');

    expect(first).toBe('');
    expect(second).toBe('');
    // One request, not one per article: the refusal is remembered for the run.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not wait twice on a host that never answered', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));

    // Deliberately not npr.org: that host is denylisted, so it never reaches the
    // circuit at all — which is the point of the test below it.
    const text = await fetchNewsSourceText('https://example.com/story');

    expect(text).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a server fault once', async () => {
    fetchMock.mockResolvedValue(htmlResponse('upstream error', 503));

    const text = await fetchNewsSourceText('https://afropop.org/story');

    expect(text).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses the part of an oversized page that arrived', async () => {
    const originalMax = process.env.AI_NEWS_SOURCE_MAX_BYTES;
    process.env.AI_NEWS_SOURCE_MAX_BYTES = '4096';

    try {
      const body = `<html><body><article>${paragraphs(6, 12)}</article>`
        + `<script>${'var player = 1;'.repeat(2_000)}</script></body></html>`;
      fetchMock.mockResolvedValue(htmlResponse(body));

      const text = await fetchNewsSourceText('https://decider.com/story');

      expect(text.split(/\s+/).length).toBeGreaterThan(60);
      // The cap ended the read; nothing was retried because the page was usable.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      if (originalMax === undefined) delete process.env.AI_NEWS_SOURCE_MAX_BYTES;
      else process.env.AI_NEWS_SOURCE_MAX_BYTES = originalMax;
    }
  });

  it('records a page with no article body and stops asking after the second', async () => {
    fetchMock.mockResolvedValue(htmlResponse('<html><body><nav>widgets</nav></body></html>'));

    await fetchNewsSourceText('https://pitchfork.com/one');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await fetchNewsSourceText('https://pitchfork.com/two');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the readable body when the page is healthy', async () => {
    fetchMock.mockResolvedValue(htmlResponse(`<html><body><article>${paragraphs(4, 10)}</article></body></html>`));

    const text = await fetchNewsSourceText('https://www.theguardian.com/music/story');

    expect(text.split(/\s+/).length).toBeGreaterThanOrEqual(40);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not open a socket to a denylisted publisher', async () => {
    const text = await fetchNewsSourceText('https://www.npr.org/2026/11/10/g-s1-152641/story');

    expect(text).toBe('');
    // No request, no stall, no retry — the policy is checked before the circuit.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('brief for a denylisted publisher', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sourceHostCircuit.reset();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sourceHostCircuit.reset();
  });

  it('publishes a link-out summary instead of an apology', async () => {
    const article = await generateAiNewsArticle({
      title: 'NPR Music reports on a festival lineup',
      excerpt: 'A teaser long enough to look like material, but only a teaser.',
      sourceUrl: 'https://www.npr.org/2026/11/10/g-s1-152641/story',
      sourceName: 'npr.org',
    });

    expect(article.failureReason).toBe('source-unavailable');
    expect(article.isAiGenerated).toBe(false);
    expect(article.articleContent).toContain('published by npr.org');
    expect(article.articleContent).not.toContain('could not complete');
    expect(article.seoDescription.length).toBeLessThanOrEqual(180);
    // Nothing was fetched and no model was asked to write 700 words from a teaser.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still treats a failed fetch elsewhere as a failure, not a decision', async () => {
    fetchMock.mockResolvedValue(htmlResponse('forbidden', 403));

    const article = await generateAiNewsArticle({
      title: 'A decider.com story',
      excerpt: '',
      sourceUrl: 'https://decider.com/2026/11/10/story',
      sourceName: 'decider.com',
    });

    expect(article.failureReason).toBe('insufficient-source');
    expect(article.articleContent).toContain('could not complete');
  });
});
