const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3';
const WIKIMEDIA_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const MEDIA_CACHE_SECONDS = 24 * 60 * 60;
const YOUTUBE_TIMEOUT_MS = 8_000;
const WIKIMEDIA_TIMEOUT_MS = 8_000;
const YOUTUBE_MAX_RESULTS = 50;
const MAX_YOUTUBE_QUERY_LENGTH = 200;
const SUBJECT_QUERY_BOUNDARIES = new Set([
  'about',
  'after',
  'announced',
  'announces',
  'as',
  'at',
  'before',
  'breaks',
  'brings',
  'celebrates',
  'celebrating',
  'details',
  'doubles',
  'enters',
  'explains',
  'features',
  'for',
  'from',
  'gets',
  'gives',
  'has',
  'in',
  'is',
  'joins',
  'launches',
  'leaves',
  'makes',
  'names',
  'of',
  'on',
  'over',
  'reveals',
  'returns',
  'shares',
  'shows',
  'speaks',
  'starts',
  'talks',
  'to',
  'unveils',
  'was',
  'were',
  'will',
  'with',
]);
const LEADING_CONTEXT_WORDS = new Set(['after', 'breaking', 'exclusive', 'how', 'inside', 'what', 'when', 'where', 'why']);
const GENERIC_SUBJECT_WORDS = new Set(['and', 'band', 'group', 'music', 'official', 'singer', 'the', 'video']);

export type RelatedNewsMedia = {
  subjectQuery: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  videoUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string | null } | null;
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string | null;
    snippet?: {
      title?: string | null;
      channelTitle?: string | null;
      publishedAt?: string | null;
    } | null;
    statistics?: {
      viewCount?: string | null;
    } | null;
  }>;
};

type WikimediaImageResult = {
  title?: string | null;
  imageinfo?: Array<{
    thumburl?: string | null;
    url?: string | null;
    mime?: string | null;
    width?: number | null;
    height?: number | null;
    timestamp?: string | null;
    extmetadata?: {
      Artist?: { value?: string | null } | null;
      Credit?: { value?: string | null } | null;
      DateTimeOriginal?: { value?: string | null } | null;
    } | null;
  }>;
};

type WikimediaImageResponse = {
  query?: { pages?: Record<string, WikimediaImageResult> };
};

export type RelatedNewsImage = {
  src: string;
  alt: string;
  caption: string;
  publishedAt?: string;
};

function isSafeYouTubeVideoId(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{11}$/.test(value));
}

function cleanQueryPart(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function extractSubjectQuery(title: string): string {
  const cleanTitle = cleanQueryPart(title);
  const titleBeforeSubtitle = cleanTitle.split(/\s*(?:\||:)\s*/, 1)[0] || cleanTitle;
  const words = titleBeforeSubtitle.split(' ').filter(Boolean);
  const subjectWords: string[] = [];

  for (const word of words) {
    const normalizedWord = normalizeSearchText(word);
    if (!normalizedWord) continue;
    if (subjectWords.length > 0 && SUBJECT_QUERY_BOUNDARIES.has(normalizedWord)) break;
    if (subjectWords.length === 0 && (LEADING_CONTEXT_WORDS.has(normalizedWord) || GENERIC_SUBJECT_WORDS.has(normalizedWord))) continue;
    subjectWords.push(word);
    if (subjectWords.length === 6) break;
  }

  return subjectWords.join(' ') || words.slice(0, 6).join(' ') || cleanTitle;
}

function buildYouTubeQuery(title: string, excerpt?: string | null): { query: string; subjectQuery: string } {
  const cleanTitle = cleanQueryPart(title);
  const subjectQuery = extractSubjectQuery(cleanTitle);
  const cleanExcerpt = cleanQueryPart(excerpt).split(/[.!?]/, 1)[0] || '';
  const excerptHint = subjectQuery === cleanTitle && cleanExcerpt
    ? ` ${cleanExcerpt.split(' ').slice(0, 8).join(' ')}`
    : '';

  return {
    subjectQuery,
    query: `${subjectQuery}${excerptHint} music video interview`.slice(0, MAX_YOUTUBE_QUERY_LENGTH),
  };
}

function matchesSubject(subjectQuery: string, videoTitle: string, channelTitle: string): boolean {
  const subjectWords = normalizeSearchText(subjectQuery)
    .split(' ')
    .filter((word) => word.length > 2 && !GENERIC_SUBJECT_WORDS.has(word))
    .slice(0, 2);
  if (subjectWords.length === 0) return true;

  const haystack = normalizeSearchText(`${videoTitle} ${channelTitle}`);
  return subjectWords.every((word) => haystack.includes(word));
}

function createYouTubeUrl(pathname: string, params: Record<string, string>): URL {
  const url = new URL(`${YOUTUBE_API_ENDPOINT}/${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchYouTubeJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate: MEDIA_CACHE_SECONDS },
      signal: AbortSignal.timeout(YOUTUBE_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`YouTube media lookup failed with HTTP ${response.status}.`);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.warn('YouTube media lookup failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

function getSafeImageUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && parsed.hostname ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function getDistinctImageUrls(excludedUrls: Array<string | null | undefined>) {
  return new Set(excludedUrls.filter((url): url is string => Boolean(url)).map((url) => getSafeImageUrl(url)).filter((url): url is string => Boolean(url)));
}

function stripMarkup(value: string | null | undefined): string {
  return cleanQueryPart(value).replace(/<[^>]*>/g, '');
}

export async function findRecentNewsImages({
  title,
  excerpt,
  excludedUrls,
}: {
  title: string;
  excerpt?: string | null;
  excludedUrls: Array<string | null | undefined>;
}): Promise<RelatedNewsImage[]> {
  const { subjectQuery } = buildYouTubeQuery(title, excerpt);
  if (!subjectQuery) return [];

  const now = new Date();
  const publishedAfterDate = new Date(now);
  publishedAfterDate.setUTCFullYear(now.getUTCFullYear() - 2);
  const url = new URL(WIKIMEDIA_API_ENDPOINT);
  url.searchParams.set('action', 'query');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', subjectQuery);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '20');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|mime|size|timestamp|extmetadata');
  url.searchParams.set('iiurlwidth', '1400');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  try {
    const response = await fetch(url, {
      next: { revalidate: MEDIA_CACHE_SECONDS },
      signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.warn(`Wikimedia image lookup failed with HTTP ${response.status}.`);
      return [];
    }

    const data = await response.json() as WikimediaImageResponse;
    const excluded = getDistinctImageUrls(excludedUrls);
    const normalizedSubject = normalizeSearchText(subjectQuery);
    const images: RelatedNewsImage[] = [];

    for (const result of Object.values(data.query?.pages || {})) {
      const imageInfo = result.imageinfo?.[0];
      const src = getSafeImageUrl(imageInfo?.thumburl || imageInfo?.url);
      const resultTitle = stripMarkup(result.title).replace(/^File:\s*/i, '');
      const normalizedResultTitle = normalizeSearchText(resultTitle);
      const uploadedAt = imageInfo?.timestamp || '';
      const uploadedDate = new Date(uploadedAt);
      const isVisualImage = Boolean(
        imageInfo?.mime?.startsWith('image/')
        && (imageInfo.width || 0) >= 320
        && (imageInfo.height || 0) >= 240,
      );

      if (
        !src
        || !isVisualImage
        || excluded.has(src)
        || !normalizedResultTitle.includes(normalizedSubject)
        || (uploadedAt && (Number.isNaN(uploadedDate.getTime()) || uploadedDate < publishedAfterDate || uploadedDate > now))
      ) continue;

      excluded.add(src);
      const credit = stripMarkup(imageInfo?.extmetadata?.Credit?.value || imageInfo?.extmetadata?.Artist?.value);
      images.push({
        src,
        alt: `${subjectQuery} — ${resultTitle}`,
        caption: `Fresh image · ${credit || 'Wikimedia Commons'}`,
      });
    }

    for (let index = images.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [images[index], images[randomIndex]] = [images[randomIndex], images[index]];
    }

    return images.slice(0, 2);
  } catch (error) {
    console.warn('Wikimedia image lookup failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function findFreshYouTubeMedia({
  title,
  excerpt,
}: {
  title: string;
  excerpt?: string | null;
}): Promise<RelatedNewsMedia | null> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const cleanTitle = cleanQueryPart(title);

  if (!apiKey || !cleanTitle) return null;

  const now = new Date();
  const publishedAfterDate = new Date(now);
  publishedAfterDate.setUTCFullYear(now.getUTCFullYear() - 2);
  const { query, subjectQuery } = buildYouTubeQuery(cleanTitle, excerpt);
  const searchUrl = createYouTubeUrl('search', {
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'viewCount',
    maxResults: String(YOUTUBE_MAX_RESULTS),
    publishedAfter: publishedAfterDate.toISOString(),
    publishedBefore: now.toISOString(),
    key: apiKey,
  });
  const searchData = await fetchYouTubeJson<YouTubeSearchResponse>(searchUrl);
  const videoIds = Array.from(new Set(
    (searchData?.items || [])
      .map((item) => item.id?.videoId || '')
      .filter(isSafeYouTubeVideoId),
  ));

  if (videoIds.length === 0) return null;

  const videosUrl = createYouTubeUrl('videos', {
    part: 'snippet,statistics',
    id: videoIds.join(','),
    key: apiKey,
  });
  const videosData = await fetchYouTubeJson<YouTubeVideosResponse>(videosUrl);
  const eligibleMedia = (videosData?.items || []).flatMap((item) => {
    const videoId = item.id || '';
    const videoTitle = cleanQueryPart(item.snippet?.title) || 'Related music video';
    const channelTitle = cleanQueryPart(item.snippet?.channelTitle) || 'YouTube';
    const publishedAt = item.snippet?.publishedAt || '';
    const publishedDate = new Date(publishedAt);
    const viewCount = Number.parseInt(item.statistics?.viewCount || '', 10);

    if (
      !isSafeYouTubeVideoId(videoId)
      || !matchesSubject(subjectQuery, videoTitle, channelTitle)
      || Number.isNaN(publishedDate.getTime())
      || publishedDate < publishedAfterDate
      || publishedDate > now
      || !Number.isFinite(viewCount)
      || viewCount < 0
    ) {
      return [];
    }

    return [{
      subjectQuery,
      videoId,
      videoTitle,
      channelTitle,
      videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
      publishedAt,
      viewCount,
    } satisfies RelatedNewsMedia];
  });

  if (eligibleMedia.length === 0) return null;

  return eligibleMedia.reduce((mostViewed, candidate) => (
    candidate.viewCount > mostViewed.viewCount ? candidate : mostViewed
  ));
}
