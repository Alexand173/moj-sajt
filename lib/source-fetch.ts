/**
 * Reading a publisher page without letting one dead site cost the run.
 *
 * Measured on 2026-11-10 against the two hosts that kept producing fallback
 * briefs, the failures were not one problem:
 *
 * - npr.org delivered zero bytes in 15,011 ms. That is an edge decision holding
 *   the connection open (Akamai sits in front of it), not a slow transfer, so
 *   waiting longer only buys a longer stall — twice, because the fetch retried.
 * - decider.com delivered 2,015,232 bytes in 214 ms. The page arrived fine and
 *   our own 2 MB cap threw it away.
 * - pitchfork.com measured 1,966,234 bytes, so the old cap was marginal for
 *   ordinary music sites and not just for outliers.
 *
 * Hence three rules, all of them here so the pipeline and the probe script cannot
 * drift apart:
 *
 * 1. A cap ends the read, it does not discard it. Whatever arrived is parsed; a
 *    page is only a failure when the extraction yields no usable words.
 * 2. A failure carries its kind. A host that never answered is not retried and is
 *    not fetched again in this run; a slow or 5xx host gets the one retry.
 * 3. A host that has already refused or stalled is remembered for the rest of the
 *    process, so the sixteenth article from that host costs nothing.
 */

/** Ceiling for one publisher response, in bytes. */
export const DEFAULT_SOURCE_MAX_BYTES = 4_000_000;
const MIN_SOURCE_MAX_BYTES = 512_000;
const MAX_SOURCE_MAX_BYTES = 16_000_000;

/**
 * A page above the cap is still parsed, so a generous ceiling costs only memory,
 * not correctness. It is bounded to keep a hostile or broken endpoint from
 * growing the worker.
 */
export function getSourceMaxBytes(): number {
  const parsed = Number.parseInt(process.env.AI_NEWS_SOURCE_MAX_BYTES || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SOURCE_MAX_BYTES;

  return Math.min(Math.max(parsed, MIN_SOURCE_MAX_BYTES), MAX_SOURCE_MAX_BYTES);
}

/**
 * How a fetch failed, from the caller's point of view.
 *
 * - `host-blocked`: nothing came back at all before the timeout — an edge rule,
 *   a hung socket, or a firewall. Retrying is a second fifteen-second stall.
 * - `host-refused`: an explicit refusal (401/403/429/451). Retrying answers the
 *   same thing and, on 429, makes it worse.
 * - `stalled`: headers arrived, then the body stopped. Worth one retry, and the
 *   bytes already read are kept.
 * - `transient`: 5xx, a reset connection, a DNS timeout worth another try.
 * - `invalid`: 404/410, a non-HTML payload, a bad redirect. Never retried.
 */
export type SourceFailureKind =
  | 'host-blocked'
  | 'host-refused'
  | 'stalled'
  | 'transient'
  | 'invalid';

const RETRYABLE_KINDS = new Set<SourceFailureKind>(['stalled', 'transient']);
/** A blocking kind is final for the run; ordinary failures get two chances. */
const BLOCKING_KINDS = new Set<SourceFailureKind>(['host-blocked', 'host-refused']);
const MAX_CONSECUTIVE_FAILURES = 2;

export function isRetryableSourceFailure(kind: SourceFailureKind): boolean {
  return RETRYABLE_KINDS.has(kind);
}

export class SourceFetchError extends Error {
  readonly kind: SourceFailureKind;
  readonly hostname: string;
  readonly status: number | null;

  constructor(
    kind: SourceFailureKind,
    message: string,
    options: { hostname: string; status?: number | null; cause?: unknown },
  ) {
    super(message);
    this.name = 'SourceFetchError';
    this.kind = kind;
    this.hostname = options.hostname;
    this.status = options.status ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** Undici reports timeouts as `TimeoutError` and manual aborts as `AbortError`. */
export function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * What an HTTP status means for this host, or `null` when it is usable.
 *
 * 408 is listed as transient rather than refused: the server is asking for the
 * request again, which is the one case where a retry is the expected answer.
 */
export function failureKindForStatus(status: number): SourceFailureKind | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403 || status === 429 || status === 451) return 'host-refused';
  if (status === 404 || status === 410) return 'invalid';
  if (status === 408 || status >= 500) return 'transient';

  return 'invalid';
}

export interface LimitedReadResult {
  text: string;
  bytesRead: number;
  /** The cap stopped the read; `text` holds everything that arrived first. */
  truncated: boolean;
  /** The body stopped mid-flight; `text` holds everything that arrived first. */
  timedOut: boolean;
}

/**
 * Reads a response body up to `maxBytes` and returns what it got.
 *
 * Unlike a throw-at-the-cap reader this keeps the partial document, because the
 * article body of a music site sits well inside the first megabyte; the rest is
 * inline player scripts. A stall after some bytes is treated the same way — a
 * page we mostly have is worth more than a fallback brief.
 */
export async function readResponseText(
  response: Response,
  options: { maxBytes?: number } = {},
): Promise<LimitedReadResult> {
  const maxBytes = options.maxBytes ?? getSourceMaxBytes();
  if (!response.body) return { text: '', bytesRead: 0, truncated: false, timedOut: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  let truncated = false;
  let timedOut = false;

  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;

      try {
        chunk = await reader.read();
      } catch (error) {
        // Headers arrived, so this is a mid-flight stall rather than a blocked
        // host. Keep the part of the page that made it.
        if (isTimeoutError(error) && chunks.length > 0) {
          timedOut = true;
          break;
        }
        throw error;
      }

      if (chunk.done) break;

      const value = chunk.value;
      const overflow = bytesRead + value.byteLength - maxBytes;
      bytesRead += value.byteLength;

      if (overflow > 0) {
        // Decode only the slice that still fits, so the partial document ends on
        // a character boundary instead of a broken code point.
        const keep = value.byteLength - overflow;
        if (keep > 0) chunks.push(decoder.decode(value.subarray(0, keep), { stream: true }));
        truncated = true;
        break;
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());

    return { text: chunks.join(''), bytesRead, truncated, timedOut };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

interface HostHealth {
  lastKind: SourceFailureKind | 'unusable';
  consecutiveFailures: number;
}

/**
 * What this process has learned about each host.
 *
 * Module state is the right lifetime here: the enrichment worker is one process
 * per run, so "this run" is exactly what should be remembered and nothing needs
 * to be persisted or invalidated across deployments. `reset()` exists for tests
 * and for a long-lived server process that wants a fresh opinion.
 */
export class SourceHostCircuit {
  private readonly health = new Map<string, HostHealth>();

  shouldSkip(hostname: string): { skip: false } | { skip: true; reason: string } {
    const entry = this.health.get(hostname.toLowerCase());
    if (!entry) return { skip: false };

    if (BLOCKING_KINDS.has(entry.lastKind as SourceFailureKind)) {
      return {
        skip: true,
        reason: `${entry.lastKind} earlier in this run`,
      };
    }

    if (entry.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        skip: true,
        reason: `${entry.consecutiveFailures} consecutive failures (${entry.lastKind})`,
      };
    }

    return { skip: false };
  }

  recordFailure(hostname: string, kind: SourceFailureKind | 'unusable'): void {
    const key = hostname.toLowerCase();
    const previous = this.health.get(key);
    this.health.set(key, {
      lastKind: kind,
      consecutiveFailures: (previous?.consecutiveFailures || 0) + 1,
    });
  }

  recordSuccess(hostname: string): void {
    this.health.delete(hostname.toLowerCase());
  }

  snapshot(): Array<{ host: string; lastKind: string; consecutiveFailures: number }> {
    return Array.from(this.health.entries()).map(([host, entry]) => ({
      host,
      lastKind: entry.lastKind,
      consecutiveFailures: entry.consecutiveFailures,
    }));
  }

  reset(): void {
    this.health.clear();
  }
}

export const sourceHostCircuit = new SourceHostCircuit();

/**
 * Publishers whose articles are never fetched for a rewrite.
 *
 * npr.org belongs here on measured evidence, not taste: its articles return zero
 * bytes in fifteen seconds from an edge decision, and its own music feed carries
 * 941-character teasers, so neither the page nor the feed can support a 400-word
 * brief. Leaving it in the queue bought a stall per article and a fallback brief
 * per row, while the page reader already shows the headline and a link to the
 * source — which is what those rows publish now.
 *
 * Decider is deliberately absent: it failed only because our 2 MB cap discarded
 * a 3.1 MB page, and Tier 1 recovered it (2,915 words in 1.3 s).
 *
 * `SOURCE_REWRITE_DENY_HOSTS` extends this list (comma-separated); set it to
 * `none` to empty it. Both directions are reversible without a deploy.
 */
export const DEFAULT_REWRITE_DENY_HOSTS = ['npr.org'];

export function getRewriteDenyHosts(): string[] {
  const configured = process.env.SOURCE_REWRITE_DENY_HOSTS?.trim();

  if (configured && /^(?:none|off)$/i.test(configured)) return [];
  if (!configured) return DEFAULT_REWRITE_DENY_HOSTS;

  const extra = configured
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_REWRITE_DENY_HOSTS, ...extra]));
}

/**
 * Matches a host and its subdomains, never a substring: `npr.org` covers
 * `www.npr.org` and `text.npr.org`, but not `snpr.org.example` or `my-npr.org`.
 */
export function isRewriteDeniedHost(
  hostname: string | null | undefined,
  denyHosts = getRewriteDenyHosts(),
): boolean {
  const host = (hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;

  return denyHosts.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/** Same question asked of a stored URL, for pages that render the source link. */
export function isRewriteDeniedSourceUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;

  try {
    return isRewriteDeniedHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface SourceFetchEvent {
  event: 'source_fetch';
  host: string;
  outcome: 'ok' | 'partial' | 'failed' | 'skipped' | 'unusable' | 'denied';
  kind?: SourceFailureKind | 'unusable';
  status?: number;
  bytes?: number;
  words?: number;
  ms?: number;
  reason?: string;
}

/**
 * One JSON line per fetch, so a run can be audited afterwards by host instead of
 * by reading prose warnings. Silent under vitest, which asserts on the same paths.
 */
export function logSourceFetch(event: SourceFetchEvent): void {
  if (process.env.VITEST) return;
  console.log(JSON.stringify(event));
}
