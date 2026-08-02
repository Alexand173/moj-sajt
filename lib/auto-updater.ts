import { google, type youtube_v3 } from 'googleapis';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

const SOUNDCHARTS_SONG_SEARCH_URL = 'https://customer.api.soundcharts.com/api/v2/song/search';
const SOUNDCHARTS_PAGE_LIMIT = 100;
const MAX_PAGES_PER_COMBINATION = 50;
const SOUNDCHARTS_TIMEOUT_MS = 20_000;
const COMBINATION_DELAY_MS = 150;
const UPSERT_CHUNK_SIZE = 50;
const MAX_ERROR_MESSAGES = 25;

export interface RegionConfig {
  regionName: string;
  countryCodes: string[];
}

export const TARGET_REGIONS: RegionConfig[] = [
  { regionName: 'US', countryCodes: ['US'] },
  { regionName: 'UK', countryCodes: ['GB'] },
  {
    regionName: 'LATINO',
    countryCodes: ['MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'DO', 'PR', 'CR', 'PA', 'UY', 'PY', 'BO', 'ES', 'PT'],
  },
  { regionName: 'GERMANY', countryCodes: ['DE'] },
  { regionName: 'FRANCE', countryCodes: ['FR'] },
  { regionName: 'ITALY', countryCodes: ['IT'] },
  { regionName: 'POLAND', countryCodes: ['PL'] },
  { regionName: 'NORDIC', countryCodes: ['SE', 'NO', 'DK', 'FI', 'IS'] },
  { regionName: 'BALTIC', countryCodes: ['EE', 'LV', 'LT'] },
  { regionName: 'BALKAN', countryCodes: ['RS', 'BA', 'BG', 'RO', 'GR', 'AL', 'HR', 'MK', 'ME', 'XK', 'SI'] },
  { regionName: 'OTHER', countryCodes: ['AT', 'BE', 'CH', 'CY', 'CZ', 'HU', 'IE', 'LU', 'MT', 'NL', 'SK'] },
  { regionName: 'ASIA', countryCodes: ['JP', 'KR', 'CN', 'IN', 'TW', 'TH', 'PH', 'ID', 'VN'] },
  { regionName: 'WORLD', countryCodes: [] },
];

export const REGION_COUNTRY_MAP: Record<string, string[]> = Object.fromEntries(
  TARGET_REGIONS.map(({ regionName, countryCodes }) => [regionName, countryCodes]),
);

export interface SCGenreMapping {
  dbGenreId: number;
  countryOverride?: string[];
}

export const SOUNDCHARTS_TO_DB_GENRE: Record<string, SCGenreMapping> = {
  rock: { dbGenreId: 1 },
  alternative: { dbGenreId: 1 },
  metal: { dbGenreId: 1 },
  blues: { dbGenreId: 1 },
  ska: { dbGenreId: 1 },
  pop: { dbGenreId: 2 },
  disco: { dbGenreId: 2 },
  latin: { dbGenreId: 2 },
  'hip-hop': { dbGenreId: 3 },
  'r-b': { dbGenreId: 4 },
  soul: { dbGenreId: 4 },
  funk: { dbGenreId: 4 },
  reggae: { dbGenreId: 4 },
  country: { dbGenreId: 5 },
  folk: { dbGenreId: 5 },
  edm: { dbGenreId: 6 },
  electro: { dbGenreId: 6 },
  'j-pop': { dbGenreId: 7, countryOverride: ['JP'] },
  'j-rock-metal': { dbGenreId: 8, countryOverride: ['JP'] },
  'k-pop': { dbGenreId: 9, countryOverride: ['KR'] },
  'c-pop': { dbGenreId: 10, countryOverride: ['CN', 'TW'] },
  'indian-pop': { dbGenreId: 11, countryOverride: ['IN'] },
  classical: { dbGenreId: 12 },
  jazz: { dbGenreId: 12 },
  kids: { dbGenreId: 12 },
  others: { dbGenreId: 12 },
  religious: { dbGenreId: 12 },
  soundtrack: { dbGenreId: 12 },
  spoken: { dbGenreId: 12 },
  sports: { dbGenreId: 12 },
  traditional: { dbGenreId: 12 },
};

export interface ChartSyncSummary {
  regions: number;
  combinations: number;
  pages: number;
  fetchedSongs: number;
  attemptedUpserts: number;
  savedSongs: number;
  failedSongs: number;
  youtubeLookups: number;
  youtubeQuotaExhausted: boolean;
  errors: string[];
}

export interface ChartSyncOptions {
  regionNames?: string[];
  genreSlugs?: string[];
  maxPagesPerCombination?: number;
  pageLimit?: number;
}

interface SoundchartsSong {
  name?: string;
  title?: string;
  creditName?: string;
  artists?: Array<{ name?: string | null }>;
  releaseDate?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  youtubeId?: string | null;
  youtube_id?: string | null;
  spotifyStats?: { streamCount?: number | null };
  stats?: { totalStreams?: number | null };
}

interface SongMedia {
  videoId: string;
  thumb: string;
}

type ExistingSongMedia = SongMedia;

interface ChartSyncDependencies {
  supabase: SupabaseClient;
  youtube: youtube_v3.Youtube | null;
}

function getEnv(name: string): string {
  return process.env[name]?.trim() || '';
}

function createSyncDependencies(): ChartSyncDependencies {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or Supabase key.');
  }

  const youtubeApiKey = getEnv('YOUTUBE_API_KEY');

  return {
    supabase: createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    youtube: youtubeApiKey
      ? google.youtube({ version: 'v3', auth: youtubeApiKey })
      : null,
  };
}

export function buildSoundchartsFilter(countryCodes: string[], genreSlug: string, now = new Date()): string {
  const todayFormatted = now.toISOString().split('T')[0];
  const startDate = `${now.getFullYear() - 1}-12-22`;
  const filterPayload: Record<string, unknown> = {
    s: 'custom.sc_trending_score|desc|month|total',
    f: {
      ftsg: genreSlug,
      frd: `${startDate}|${todayFormatted}`,
    },
    mi: [['audience.spotify.total', { mm: '' }]],
  };

  if (countryCodes.length > 0) {
    (filterPayload.f as Record<string, string>).fc = countryCodes.join(',');
  }

  return Buffer.from(JSON.stringify(filterPayload)).toString('base64');
}

function createEmptySummary(): ChartSyncSummary {
  return {
    regions: 0,
    combinations: 0,
    pages: 0,
    fetchedSongs: 0,
    attemptedUpserts: 0,
    savedSongs: 0,
    failedSongs: 0,
    youtubeLookups: 0,
    youtubeQuotaExhausted: false,
    errors: [],
  };
}

function addError(summary: ChartSyncSummary, message: string): void {
  if (summary.errors.length < MAX_ERROR_MESSAGES) summary.errors.push(message);
}

function getSongTitle(song: SoundchartsSong): string {
  return song.name?.trim() || song.title?.trim() || '';
}

function getArtistName(song: SoundchartsSong): string {
  return song.creditName?.trim() || song.artists?.[0]?.name?.trim() || 'Unknown Artist';
}

function getSongImage(song: SoundchartsSong): string {
  return song.imageUrl?.trim() || song.avatarUrl?.trim() || '';
}

function getReleaseDate(song: SoundchartsSong): string {
  const releaseDate = song.releaseDate?.split('T')[0];
  return releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ? releaseDate : '2026-01-01';
}

function getStreamCount(song: SoundchartsSong): number {
  return song.spotifyStats?.streamCount || song.stats?.totalStreams || 0;
}

function getSoundchartsMedia(song: SoundchartsSong): SongMedia {
  return {
    videoId: song.youtubeId?.trim() || song.youtube_id?.trim() || '',
    thumb: getSongImage(song),
  };
}

function getMediaCacheKey(title: string, artistName: string): string {
  return `${artistName.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}

async function loadExistingSongMedia(
  supabase: SupabaseClient,
  regionName: string,
  genreId: number,
): Promise<Map<string, ExistingSongMedia>> {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('title, artist_name, youtube_id, slika_url')
      .eq('region', regionName)
      .eq('genre_id', genreId)
      .limit(5000);

    if (error || !data) return new Map();

    return new Map(
      data.flatMap((row) => {
        if (typeof row.title !== 'string' || typeof row.artist_name !== 'string') return [];
        return [[
          getMediaCacheKey(row.title, row.artist_name),
          {
            videoId: typeof row.youtube_id === 'string' ? row.youtube_id : '',
            thumb: typeof row.slika_url === 'string' ? row.slika_url : '',
          },
        ]];
      }),
    );
  } catch {
    return new Map();
  }
}

async function getYoutubeDetails(
  artistName: string,
  songTitle: string,
  song: SoundchartsSong,
  youtube: youtube_v3.Youtube | null,
  mediaCache: Map<string, SongMedia>,
  summary: ChartSyncSummary,
): Promise<SongMedia> {
  const soundchartsMedia = getSoundchartsMedia(song);
  const fullQuery = `${artistName} - ${songTitle}`;
  const cacheKey = getMediaCacheKey(songTitle, artistName);
  const cachedMedia = mediaCache.get(cacheKey);

  if (cachedMedia) return cachedMedia;
  if (soundchartsMedia.videoId || !youtube || summary.youtubeQuotaExhausted) {
    mediaCache.set(cacheKey, soundchartsMedia);
    return soundchartsMedia;
  }

  summary.youtubeLookups += 1;

  try {
    const ytRes = await youtube.search.list({
      part: ['id', 'snippet'],
      q: `${fullQuery} official video`,
      maxResults: 1,
      type: ['video'],
    });

    const item = ytRes.data.items?.[0];
    const media = {
      videoId: item?.id?.videoId || '',
      thumb: item?.snippet?.thumbnails?.high?.url || soundchartsMedia.thumb,
    };

    mediaCache.set(cacheKey, media);
    return media;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if ((error as { status?: number })?.status === 403 || message.toLowerCase().includes('quota')) {
      summary.youtubeQuotaExhausted = true;
      console.warn('YouTube API quota exhausted; using Soundcharts media for the rest of this run.');
    } else {
      console.warn(`YouTube lookup failed for "${fullQuery}": ${message}`);
    }

    mediaCache.set(cacheKey, soundchartsMedia);
    return soundchartsMedia;
  }
}

function toSongRow(
  song: SoundchartsSong,
  regionName: string,
  genreId: number,
  media: SongMedia,
  existingMedia: ExistingSongMedia | null,
) {
  const title = getSongTitle(song);
  const artistName = getArtistName(song);
  const releaseDate = getReleaseDate(song);
  const fallbackMedia = existingMedia || { videoId: '', thumb: '' };

  return {
    title,
    artist_name: artistName,
    release_date: releaseDate,
    slika_url: media.thumb || fallbackMedia.thumb,
    youtube_id: media.videoId || fallbackMedia.videoId,
    region: regionName,
    genre_id: genreId,
    year: new Date(releaseDate).getFullYear(),
    is_chart: true,
    viewers: getStreamCount(song),
    votes: 0,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSongRows(
  supabase: SupabaseClient,
  rows: Array<ReturnType<typeof toSongRow>>,
  summary: ChartSyncSummary,
): Promise<void> {
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK_SIZE);
    summary.attemptedUpserts += chunk.length;

    try {
      const { error } = await supabase.from('songs').upsert(chunk, {
        onConflict: 'title,artist_name,region,genre_id',
      });

      if (error) throw error;
      summary.savedSongs += chunk.length;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedSongs += chunk.length;
      addError(summary, `Songs upsert failed (${chunk.length} rows): ${message}`);
      console.error(`Song upsert failed for ${chunk.length} rows:`, message);
    }
  }
}

async function syncSingleCombination(
  dependencies: ChartSyncDependencies,
  summary: ChartSyncSummary,
  region: RegionConfig,
  genreSlug: string,
  genreMapping: SCGenreMapping,
  options: Required<Pick<ChartSyncOptions, 'maxPagesPerCombination' | 'pageLimit'>>,
  mediaCache: Map<string, SongMedia>,
): Promise<void> {
  const countryCodes = genreMapping.countryOverride || region.countryCodes;
  const rawFilters = buildSoundchartsFilter(countryCodes, genreSlug);
  const existingMedia = await loadExistingSongMedia(
    dependencies.supabase,
    region.regionName,
    genreMapping.dbGenreId,
  );
  let offset = 0;

  for (let page = 0; page < options.maxPagesPerCombination; page += 1) {
    try {
      const response = await axios.get<{ items?: SoundchartsSong[] }>(SOUNDCHARTS_SONG_SEARCH_URL, {
        timeout: SOUNDCHARTS_TIMEOUT_MS,
        headers: {
          'x-app-id': getEnv('SOUNDCHARTS_APP_ID'),
          'x-app-key': getEnv('SOUNDCHARTS_APP_KEY'),
          'x-api-key': getEnv('SOUNDCHARTS_APP_KEY'),
          Accept: 'application/json',
        },
        params: {
          filters: rawFilters,
          limit: options.pageLimit,
          offset,
        },
      });

      const songs = response.data?.items || [];
      summary.pages += 1;
      summary.fetchedSongs += songs.length;

      if (songs.length === 0) return;

      const rows: Array<ReturnType<typeof toSongRow>> = [];
      for (const song of songs) {
        const title = getSongTitle(song);
        if (!title) {
          summary.failedSongs += 1;
          addError(summary, `Skipped Soundcharts row without a title in ${region.regionName}/${genreSlug}.`);
          continue;
        }

        const artistName = getArtistName(song);
        const existingSongMedia = existingMedia.get(getMediaCacheKey(title, artistName)) || null;
        const media = existingSongMedia?.videoId
          ? existingSongMedia
          : await getYoutubeDetails(artistName, title, song, dependencies.youtube, mediaCache, summary);

        rows.push(toSongRow(song, region.regionName, genreMapping.dbGenreId, media, existingSongMedia));
      }

      await upsertSongRows(dependencies.supabase, rows, summary);

      if (songs.length < options.pageLimit) return;
      offset += options.pageLimit;
      await new Promise((resolve) => setTimeout(resolve, COMBINATION_DELAY_MS));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const combination = `${region.regionName}/${genreSlug}`;
      addError(summary, `${combination}: ${message}`);
      console.error(`Soundcharts sync failed for ${combination}:`, message);
      return;
    }
  }

  addError(summary, `${region.regionName}/${genreSlug}: reached the ${options.maxPagesPerCombination}-page safety limit.`);
}

export async function runBulkImport(options: ChartSyncOptions = {}): Promise<ChartSyncSummary> {
  const dependencies = createSyncDependencies();
  const summary = createEmptySummary();
  const mediaCache = new Map<string, SongMedia>();
  const maxPagesPerCombination = Math.min(
    Math.max(Math.floor(options.maxPagesPerCombination || MAX_PAGES_PER_COMBINATION), 1),
    MAX_PAGES_PER_COMBINATION,
  );
  const pageLimit = Math.min(Math.max(Math.floor(options.pageLimit || SOUNDCHARTS_PAGE_LIMIT), 1), SOUNDCHARTS_PAGE_LIMIT);
  const selectedRegions = options.regionNames?.length
    ? TARGET_REGIONS.filter((region) => options.regionNames?.includes(region.regionName))
    : TARGET_REGIONS;
  const selectedGenres = options.genreSlugs?.length
    ? Object.entries(SOUNDCHARTS_TO_DB_GENRE).filter(([slug]) => options.genreSlugs?.includes(slug))
    : Object.entries(SOUNDCHARTS_TO_DB_GENRE);

  summary.regions = selectedRegions.length;
  summary.combinations = selectedRegions.length * selectedGenres.length;

  console.log(`Starting Soundcharts sync: ${summary.combinations} combinations, ${pageLimit} rows per page.`);

  for (const region of selectedRegions) {
    for (const [genreSlug, genreMapping] of selectedGenres) {
      await syncSingleCombination(
        dependencies,
        summary,
        region,
        genreSlug,
        genreMapping,
        { maxPagesPerCombination, pageLimit },
        mediaCache,
      );
      await new Promise((resolve) => setTimeout(resolve, COMBINATION_DELAY_MS));
    }
  }

  console.log('Soundcharts sync complete:', summary);
  return summary;
}

// Kept as a compatibility alias for the existing API route name.
export const runCompleteAutomatedSync = runBulkImport;
