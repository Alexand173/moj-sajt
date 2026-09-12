import { mkdir, writeFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const CONCERT_TABLE = 'koncerti';
const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_MAX_ARTISTS = 75;
const DEFAULT_PAGE_SIZE = 1_000;
const FRESHNESS_DAYS = 365;
const YOUTUBE_TIMEOUT_MS = 20_000;
const DISALLOWED_TERMS = /\b(?:reaction|reacts|karaoke|cover|tribute|fan[- ]?(?:made|video|upload)|unofficial|bootleg|parody|audition)\b/i;
const TOUR_TERMS = /\b(?:tour|concert|live|performance|announcement|announced|dates|festival|rehearsal|teaser|clip|show|stage|on\s+the\s+road)\b/i;
const OFFICIAL_TERMS = /\b(?:official|vevo|topic|ticketmaster|livenation|live\s+nation|promoter)\b/i;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ConcertRow = {
  artist_name: unknown;
  video_url: unknown;
};

type YouTubeSearchItem = {
  id?: { videoId?: string | null } | null;
  snippet?: {
    title?: string | null;
    channelTitle?: string | null;
    description?: string | null;
    publishedAt?: string | null;
  } | null;
};

type YouTubeSearchResponse = { items?: YouTubeSearchItem[] };
type YouTubeVideoItem = {
  id?: string | null;
  snippet?: { publishedAt?: string | null } | null;
};
type YouTubeVideosResponse = { items?: YouTubeVideoItem[] };

type ArtistRecord = {
  artistName: string;
  sourceNames: string[];
  rowCount: number;
  rowsWithVideo: number;
  existingUrls: string[];
};

export type ConcertVideoResult = {
  artist: string;
  status: 'updated' | 'skipped-fresh-existing' | 'unresolved' | 'failed';
  videoUrl?: string;
  reason?: string;
};

export type ConcertVideoSummary = {
  inspectedRows: number;
  uniqueArtists: number;
  processedArtists: number;
  updated: number;
  skippedFreshExisting: number;
  unresolved: number;
  failed: number;
  results: ConcertVideoResult[];
};

type WorkerOptions = {
  supabase?: SupabaseClient;
  fetchImpl?: FetchLike;
  now?: Date;
  maxArtists?: number;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeArtist(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function artistTokens(artistName: string): string[] {
  return normalizeArtist(artistName).split(' ').filter((token) => token.length > 1);
}

export function getYouTubeVideoId(value: unknown): string | null {
  const raw = cleanText(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(hostname)) return null;

    let candidate = '';
    if (hostname === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.pathname === '/watch') candidate = url.searchParams.get('v') || '';
    else candidate = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || '';

    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function getFreshnessBoundary(now: Date): Date {
  const boundary = new Date(now);
  boundary.setUTCDate(boundary.getUTCDate() - FRESHNESS_DAYS);
  return boundary;
}

function isFreshPublishedAt(value: unknown, now: Date): boolean {
  const publishedAt = new Date(cleanText(value));
  return Number.isFinite(publishedAt.getTime())
    && publishedAt >= getFreshnessBoundary(now)
    && publishedAt <= now;
}

function canonicalVideoUrl(value: unknown): string | null {
  const videoId = getYouTubeVideoId(value);
  return videoId ? getYouTubeWatchUrl(videoId) : null;
}

function buildYouTubeUrl(pathname: string, params: Record<string, string>): URL {
  const url = new URL(`${YOUTUBE_API_ENDPOINT}/${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchJson<T>(url: URL, fetchImpl: FetchLike): Promise<T> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`YouTube API returned HTTP ${response.status}.`);
  return await response.json() as T;
}

function scoreCandidate(artistName: string, item: YouTubeSearchItem): number {
  const title = cleanText(item.snippet?.title);
  const channel = cleanText(item.snippet?.channelTitle);
  const description = cleanText(item.snippet?.description);
  const haystack = `${title} ${channel} ${description}`;
  const normalizedHaystack = normalizeArtist(haystack);
  const tokens = artistTokens(artistName);
  const artistMatches = tokens.filter((token) => normalizedHaystack.includes(token));
  const channelMatches = tokens.filter((token) => normalizeArtist(channel).includes(token));

  if (artistMatches.length < Math.min(tokens.length, 1)) return -100;
  if (DISALLOWED_TERMS.test(haystack)) return -100;
  if (!TOUR_TERMS.test(haystack)) return -100;

  let score = artistMatches.length * 4;
  if (channelMatches.length > 0) score += 4;
  if (OFFICIAL_TERMS.test(haystack)) score += 3;
  if (/\b(?:tour|concert|announcement|announced|dates|on\s+the\s+road)\b/i.test(haystack)) score += 3;
  return score;
}

export function selectFreshOfficialVideo(
  artistName: string,
  items: YouTubeSearchItem[],
  now = new Date(),
): { videoId: string; videoUrl: string; publishedAt: string } | null {
  const candidates = items.flatMap((item) => {
    const videoId = item.id?.videoId || '';
    const publishedAt = cleanText(item.snippet?.publishedAt);
    const score = scoreCandidate(artistName, item);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || score < 7 || !isFreshPublishedAt(publishedAt, now)) return [];
    return [{ videoId, videoUrl: getYouTubeWatchUrl(videoId), publishedAt, score }];
  });

  candidates.sort((a, b) => {
    const dateDifference = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    return dateDifference || b.score - a.score;
  });

  const selected = candidates[0];
  return selected ? { videoId: selected.videoId, videoUrl: selected.videoUrl, publishedAt: selected.publishedAt } : null;
}

function getStoredArtistName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function groupArtistRows(rows: ConcertRow[]): Map<string, ArtistRecord> {
  const grouped = new Map<string, ArtistRecord>();
  for (const row of rows) {
    const artistName = getStoredArtistName(row.artist_name);
    const key = normalizeArtist(artistName);
    if (!key) continue;

    const existing = grouped.get(key);
    const videoUrl = canonicalVideoUrl(row.video_url);
    if (!existing) {
      grouped.set(key, {
        artistName,
        sourceNames: [artistName],
        rowCount: 1,
        rowsWithVideo: videoUrl ? 1 : 0,
        existingUrls: videoUrl ? [videoUrl] : [],
      });
      continue;
    }

    existing.rowCount += 1;
    if (!existing.sourceNames.includes(artistName)) existing.sourceNames.push(artistName);
    if (videoUrl) {
      existing.rowsWithVideo += 1;
      if (!existing.existingUrls.includes(videoUrl)) existing.existingUrls.push(videoUrl);
    }
  }
  return grouped;
}

async function loadConcertRows(supabase: SupabaseClient): Promise<ConcertRow[]> {
  const rows: ConcertRow[] = [];
  for (let start = 0; ; start += DEFAULT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(CONCERT_TABLE)
      .select('artist_name, video_url')
      .range(start, start + DEFAULT_PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read koncerti: ${error.message}`);
    const page = (data || []) as ConcertRow[];
    rows.push(...page);
    if (page.length < DEFAULT_PAGE_SIZE) return rows;
  }
}

async function findFreshExistingVideoIds(
  ids: string[],
  now: Date,
  fetchImpl: FetchLike,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const freshIds = new Set<string>();
  for (let start = 0; start < ids.length; start += 50) {
    const url = buildYouTubeUrl('videos', {
      part: 'snippet',
      id: ids.slice(start, start + 50).join(','),
      key: process.env.YOUTUBE_API_KEY?.trim() || '',
    });
    const data = await fetchJson<YouTubeVideosResponse>(url, fetchImpl);
    (data.items || [])
      .filter((item) => item.id && isFreshPublishedAt(item.snippet?.publishedAt, now))
      .forEach((item) => freshIds.add(item.id as string));
  }
  return freshIds;
}

async function searchArtistVideo(artistName: string, now: Date, fetchImpl: FetchLike): Promise<ReturnType<typeof selectFreshOfficialVideo>> {
  const publishedAfter = getFreshnessBoundary(now).toISOString();
  const publishedBefore = now.toISOString();
  const url = buildYouTubeUrl('search', {
    part: 'snippet',
    q: `${artistName} official tour announcement live clip`,
    type: 'video',
    order: 'date',
    maxResults: '25',
    publishedAfter,
    publishedBefore,
    key: process.env.YOUTUBE_API_KEY?.trim() || '',
  });
  const data = await fetchJson<YouTubeSearchResponse>(url, fetchImpl);
  return selectFreshOfficialVideo(artistName, data.items || [], now);
}

async function updateArtistVideo(supabase: SupabaseClient, artist: ArtistRecord, videoUrl: string): Promise<void> {
  const { error } = await supabase
    .from(CONCERT_TABLE)
    .update({ video_url: videoUrl })
    .in('artist_name', artist.sourceNames);
  if (error) throw new Error(`Could not update ${artist.artistName}: ${error.message}`);
}

function createSupabaseClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function runConcertVideoEnrichment(options: WorkerOptions = {}): Promise<ConcertVideoSummary> {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || new Date();
  const maxArtists = options.maxArtists || Number.parseInt(process.env.CONCERT_VIDEO_MAX_ARTISTS || '', 10) || DEFAULT_MAX_ARTISTS;
  if (!process.env.YOUTUBE_API_KEY?.trim()) throw new Error('YOUTUBE_API_KEY is required.');
  const supabase = options.supabase || createSupabaseClient();
  const rows = await loadConcertRows(supabase);
  const requestedArtist = getStoredArtistName(process.env.CONCERT_VIDEO_ARTIST);
  const allArtists = Array.from(groupArtistRows(rows).values());
  const matchingArtists = requestedArtist
    ? allArtists.filter((artist) => artist.sourceNames.includes(requestedArtist))
    : allArtists;
  if (requestedArtist && matchingArtists.length === 0) {
    throw new Error(`No koncerti row found with artist_name exactly equal to ${requestedArtist}.`);
  }
  const artists = matchingArtists.slice(0, Math.max(maxArtists, 1));
  const allExistingIds = Array.from(new Set(artists.flatMap((artist) => artist.existingUrls.map((url) => getYouTubeVideoId(url)).filter((id): id is string => Boolean(id)))));
  let freshExistingIds = new Set<string>();

  if (allExistingIds.length > 0) {
    try {
      freshExistingIds = await findFreshExistingVideoIds(allExistingIds, now, fetchImpl);
    } catch (error) {
      console.warn(`Could not validate existing koncerti video URLs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const results: ConcertVideoResult[] = [];
  for (const artist of artists) {
    const freshExistingUrl = artist.existingUrls.find((url) => {
      const videoId = getYouTubeVideoId(url);
      return Boolean(videoId && freshExistingIds.has(videoId));
    });

    if (freshExistingUrl) {
      const alreadyCanonicalForAllRows = artist.existingUrls.length === 1
        && artist.sourceNames.length === 1
        && artist.rowsWithVideo === artist.rowCount;
      if (alreadyCanonicalForAllRows) {
        results.push({ artist: artist.artistName, status: 'skipped-fresh-existing', videoUrl: freshExistingUrl });
        continue;
      }

      try {
        await updateArtistVideo(supabase, artist, freshExistingUrl);
        results.push({ artist: artist.artistName, status: 'updated', videoUrl: freshExistingUrl, reason: 'normalized duplicate artist rows' });
      } catch (error) {
        results.push({ artist: artist.artistName, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
      }
      continue;
    }

    try {
      const selected = await searchArtistVideo(artist.artistName, now, fetchImpl);
      if (!selected) {
        results.push({ artist: artist.artistName, status: 'unresolved', reason: 'No fresh official tour video matched the filters.' });
        continue;
      }

      await updateArtistVideo(supabase, artist, selected.videoUrl);
      results.push({ artist: artist.artistName, status: 'updated', videoUrl: selected.videoUrl });
    } catch (error) {
      results.push({ artist: artist.artistName, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    inspectedRows: rows.length,
    uniqueArtists: groupArtistRows(rows).size,
    processedArtists: artists.length,
    updated: results.filter((result) => result.status === 'updated').length,
    skippedFreshExisting: results.filter((result) => result.status === 'skipped-fresh-existing').length,
    unresolved: results.filter((result) => result.status === 'unresolved').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}

async function main(): Promise<void> {
  const summary = await runConcertVideoEnrichment();
  const outputPath = process.env.CONCERT_VIDEO_SUMMARY_PATH?.trim();
  if (outputPath) {
    const separatorIndex = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
    if (separatorIndex > 0) await mkdir(outputPath.slice(0, separatorIndex), { recursive: true });
    await writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  }
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('enrich-concert-videos.ts')) {
  loadEnvConfig(process.cwd());
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
