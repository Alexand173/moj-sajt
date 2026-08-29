const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_IMAGE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const WIKIMEDIA_API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';
const MEDIA_CACHE_SECONDS = 24 * 60 * 60;
const YOUTUBE_TIMEOUT_MS = 8_000;
const GOOGLE_TIMEOUT_MS = 8_000;
const WIKIMEDIA_TIMEOUT_MS = 8_000;
const WIKIMEDIA_RETRY_LIMIT = 2;
const WIKIMEDIA_RETRY_DELAY_MS = 750;
const WIKIMEDIA_USER_AGENT = 'MusicTop/1.0 (https://musictop.net; contact@musictop.net)';
const GOOGLE_MAX_RESULTS = 10;
const YOUTUBE_MAX_RESULTS = 50;
const MAX_YOUTUBE_QUERY_LENGTH = 200;
const SUBJECT_QUERY_BOUNDARIES = new Set([
  'about',
  'after',
  'announce',
  'announces',
  'announced',
  'spark',
  'sparks',
  'sparked',
  'as',
  'at',
  'before',
  'breaks',
  'brings',
  'canceled',
  'canceling',
  'cancelled',
  'cancels',
  'celebrates',
  'celebrating',
  'details',
  'doubles',
  'dropped',
  'drops',
  'enters',
  'explains',
  'faces',
  'features',
  'fends',
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
  'opens',
  'over',
  'questions',
  'reports',
  'reveals',
  'returns',
  'says',
  'shares',
  'shows',
  'speaks',
  'suffers',
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
const SUBJECT_PREFIX_WORDS = new Set(['reason', 'reasons', 'thing', 'things', 'way', 'ways', 'guide', 'review', 'premiere', 'premieres']);
const GENERIC_SUBJECT_WORDS = new Set(['and', 'artist', 'artists', 'band', 'company', 'companies', 'group', 'industry', 'music', 'official', 'singer', 'the', 'video']);
const NON_EDITORIAL_IMAGE_TERMS = /\b(?:album\s+cover|cover\s+art|economic\s+zones?|flag|icon|logo|map|poster|screenshot|symbol|wordmark)\b/i;

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

type GoogleImageSearchResponse = {
  items?: Array<{
    link?: string | null;
    title?: string | null;
    displayLink?: string | null;
    mime?: string | null;
    image?: {
      contextLink?: string | null;
      fileFormat?: string | null;
      height?: number | null;
      thumbnailLink?: string | null;
      width?: number | null;
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
      ImageDescription?: { value?: string | null } | null;
      ObjectName?: { value?: string | null } | null;
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
  const titleBeforePipe = cleanTitle.split(/\s*\|\s*/, 1)[0] || cleanTitle;
  const colonParts = titleBeforePipe.split(/\s*:\s*/);
  const firstColonPart = normalizeSearchText(colonParts[0] || '');
  const titleBeforeSubtitle = colonParts.length > 1 && LEADING_CONTEXT_WORDS.has(firstColonPart)
    ? colonParts.slice(1).join(' ')
    : titleBeforePipe;
  const words = titleBeforeSubtitle.split(' ').filter(Boolean);
  const subjectWords: string[] = [];

  for (const word of words) {
    const normalizedWord = normalizeSearchText(word);
    if (!normalizedWord) continue;
    if (/^\d+$/.test(normalizedWord)) continue;
    if (subjectWords.length > 0 && SUBJECT_QUERY_BOUNDARIES.has(normalizedWord)) break;
    if (
      subjectWords.length === 0
      && (
        LEADING_CONTEXT_WORDS.has(normalizedWord)
        || SUBJECT_PREFIX_WORDS.has(normalizedWord)
        || GENERIC_SUBJECT_WORDS.has(normalizedWord)
      )
    ) continue;
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
    query: `${subjectQuery}${excerptHint} live performance interview music video`.slice(0, MAX_YOUTUBE_QUERY_LENGTH),
  };
}

function getGoogleSearchConfig(): { apiKey: string; searchEngineId: string } {
  return {
    apiKey: process.env.GOOGLE_SEARCH_API_KEY?.trim() || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim() || '',
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID?.trim() || process.env.GOOGLE_CSE_ID?.trim() || '',
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

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1_000, 10_000);
  return WIKIMEDIA_RETRY_DELAY_MS * (attempt + 1);
}

async function fetchWikimediaJson<T>(url: URL): Promise<T | null> {
  for (let attempt = 0; attempt <= WIKIMEDIA_RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetch(url, {
        next: { revalidate: MEDIA_CACHE_SECONDS },
        signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
        headers: {
          Accept: 'application/json',
          'User-Agent': WIKIMEDIA_USER_AGENT,
        },
      });

      if (response.ok) return await response.json() as T;

      const canRetry = response.status === 429 || response.status >= 500;
      if (!canRetry || attempt === WIKIMEDIA_RETRY_LIMIT) {
        console.warn(`Wikimedia image lookup failed with HTTP ${response.status}.`);
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, getRetryDelay(response, attempt)));
    } catch (error) {
      if (attempt === WIKIMEDIA_RETRY_LIMIT) {
        console.warn('Wikimedia image lookup failed:', error instanceof Error ? error.message : error);
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, WIKIMEDIA_RETRY_DELAY_MS * (attempt + 1)));
    }
  }

  return null;
}

export function getSafeMediaUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && parsed.hostname ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function isLikelyEditorialImageUrl(value: string | null | undefined): boolean {
  const safeUrl = getSafeMediaUrl(value);
  if (!safeUrl) return false;

  try {
    const parsed = new URL(safeUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = decodeURIComponent(parsed.pathname).replace(/[_-]+/g, ' ');
    return !YOUTUBE_HOSTNAMES.has(hostname)
      && !/\.svg(?:\.png)?$/i.test(parsed.pathname)
      && !NON_EDITORIAL_IMAGE_TERMS.test(pathname);
  } catch {
    return false;
  }
}

export function getMediaIdentity(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

const YOUTUBE_HOSTNAMES = new Set(['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com']);

export function getYouTubeVideoId(value: string | null | undefined): string | null {
  const safeUrl = getSafeMediaUrl(value);
  if (!safeUrl) return null;

  try {
    const parsed = new URL(safeUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!YOUTUBE_HOSTNAMES.has(hostname)) return null;

    let candidate = '';
    if (hostname === 'youtu.be') {
      candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v') || '';
    } else {
      candidate = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || '';
    }

    return isSafeYouTubeVideoId(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}

export function getStoredNewsMediaUrl(value: string | null | undefined): string | null {
  const safeUrl = getSafeMediaUrl(value);
  if (!safeUrl) return null;

  return getYouTubeVideoId(safeUrl) || isLikelyEditorialImageUrl(safeUrl) ? safeUrl : null;
}

function getDistinctImageUrls(excludedUrls: Array<string | null | undefined>) {
  return new Set(
    excludedUrls
      .filter((url): url is string => Boolean(url))
      .map((url) => getSafeMediaUrl(url))
      .filter((url): url is string => Boolean(url))
      .map(getMediaIdentity),
  );
}

function stripMarkup(value: string | null | undefined): string {
  return cleanQueryPart(value).replace(/<[^>]*>/g, '');
}

function getSubjectTokens(subjectQuery: string): string[] {
  return normalizeSearchText(subjectQuery)
    .split(' ')
    .filter((word) => word.length > 2 && !GENERIC_SUBJECT_WORDS.has(word) && !SUBJECT_PREFIX_WORDS.has(word) && !/^\d+$/.test(word));
}

function matchesImageSubject(subjectQuery: string, resultTitle: string, description: string): boolean {
  const subjectTokens = getSubjectTokens(subjectQuery);
  if (subjectTokens.length === 0) return true;

  const haystack = normalizeSearchText(`${resultTitle} ${description}`);
  const matchedTokens = subjectTokens.filter((token) => haystack.includes(token));
  const requiredMatches = subjectTokens.length === 1 ? 1 : Math.min(2, subjectTokens.length);
  return matchedTokens.length >= requiredMatches;
}

export async function findGoogleNewsImages({
  title,
  excerpt,
  excludedUrls,
}: {
  title: string;
  excerpt?: string | null;
  excludedUrls: Array<string | null | undefined>;
}): Promise<RelatedNewsImage[]> {
  const { apiKey, searchEngineId } = getGoogleSearchConfig();
  if (!apiKey || !searchEngineId) return [];

  const { subjectQuery } = buildYouTubeQuery(title, excerpt);
  if (!subjectQuery) return [];

  const url = new URL(GOOGLE_IMAGE_SEARCH_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', searchEngineId);
  url.searchParams.set('q', `${subjectQuery} musician band person`);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', String(GOOGLE_MAX_RESULTS));
  url.searchParams.set('safe', 'active');
  url.searchParams.set('imgType', 'photo');

  try {
    const response = await fetch(url, {
      next: { revalidate: MEDIA_CACHE_SECONDS },
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Google image lookup failed with HTTP ${response.status}.`);
      return [];
    }

    const data = await response.json() as GoogleImageSearchResponse;
    const excluded = getDistinctImageUrls(excludedUrls);
    const images: RelatedNewsImage[] = [];

    for (const result of data.items || []) {
      const imageInfo = result.image;
      const src = getSafeMediaUrl(result.link);
      const resultTitle = stripMarkup(result.title);
      const resultDescription = stripMarkup(`${result.displayLink || ''} ${imageInfo?.contextLink || ''}`);
      const mime = result.mime || imageInfo?.fileFormat || '';
      const width = imageInfo?.width || 0;
      const height = imageInfo?.height || 0;
      const imageIdentity = src ? getMediaIdentity(src) : '';
      const hasUsableDimensions = !width && !height || (width >= 320 && height >= 240);

      if (
        !src
        || (mime && !mime.toLowerCase().startsWith('image/'))
        || !hasUsableDimensions
        || !isLikelyEditorialImageUrl(src)
        || excluded.has(imageIdentity)
        || NON_EDITORIAL_IMAGE_TERMS.test(`${resultTitle} ${resultDescription}`)
        || !matchesImageSubject(subjectQuery, resultTitle, resultDescription)
      ) continue;

      excluded.add(imageIdentity);
      images.push({
        src,
        alt: `${subjectQuery} — ${resultTitle || 'related person or group image'}`,
        caption: `Related image · ${result.displayLink || 'Google Images result'}`,
      });
    }

    for (let index = images.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [images[index], images[randomIndex]] = [images[randomIndex], images[index]];
    }

    return images.slice(0, 2);
  } catch (error) {
    console.warn('Google image lookup failed:', error instanceof Error ? error.message : error);
    return [];
  }
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
    const data = await fetchWikimediaJson<WikimediaImageResponse>(url);
    if (!data) return [];
    const excluded = getDistinctImageUrls(excludedUrls);
    const images: RelatedNewsImage[] = [];

    for (const result of Object.values(data.query?.pages || {})) {
      const imageInfo = result.imageinfo?.[0];
      const src = getSafeMediaUrl(imageInfo?.thumburl || imageInfo?.url);
      const resultTitle = stripMarkup(result.title).replace(/^File:\s*/i, '');
      const description = stripMarkup(imageInfo?.extmetadata?.ImageDescription?.value || imageInfo?.extmetadata?.ObjectName?.value);
      const uploadedAt = imageInfo?.timestamp || '';
      const uploadedDate = new Date(uploadedAt);
      const isVisualImage = Boolean(
        imageInfo?.mime?.startsWith('image/')
        && (imageInfo.width || 0) >= 320
        && (imageInfo.height || 0) >= 240,
      );
      const imageIdentity = src ? getMediaIdentity(src) : '';

      if (
        !src
        || !isVisualImage
        || !isLikelyEditorialImageUrl(src)
        || excluded.has(imageIdentity)
        || NON_EDITORIAL_IMAGE_TERMS.test(`${resultTitle} ${description}`)
        || !matchesImageSubject(subjectQuery, resultTitle, description)
        || (uploadedAt && (Number.isNaN(uploadedDate.getTime()) || uploadedDate > now))
      ) continue;

      excluded.add(imageIdentity);
      const credit = stripMarkup(imageInfo?.extmetadata?.Credit?.value || imageInfo?.extmetadata?.Artist?.value);
      images.push({
        src,
        alt: `${subjectQuery} — ${resultTitle}`,
        caption: `Fresh image · ${credit || 'Wikimedia Commons'}`,
        publishedAt: uploadedAt || undefined,
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
      videoUrl: getYouTubeWatchUrl(videoId),
      embedUrl: getYouTubeEmbedUrl(videoId),
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

export type RelatedNewsMediaResolution = {
  video: RelatedNewsMedia | null;
  images: RelatedNewsImage[];
};

export type PersistedNewsMedia = {
  layout1: string | null;
  layout2: string | null;
};

function getCanonicalYouTubeWatchUrl(value: string | null | undefined): string | null {
  const videoId = getYouTubeVideoId(value);
  return videoId ? getYouTubeWatchUrl(videoId) : null;
}

/**
 * Converts a resolved media response into the two URL columns used by the
 * news table. Existing valid values are preserved so retries cannot replace
 * an editorially selected media URL with a different random result.
 */
export function persistResolvedNewsMedia(
  resolution: RelatedNewsMediaResolution,
  existing: PersistedNewsMedia = { layout1: null, layout2: null },
  needsSecondImage = true,
): PersistedNewsMedia {
  const existingLayout1 = getSafeMediaUrl(existing.layout1);
  const existingLayout2Candidate = getSafeMediaUrl(existing.layout2);
  const existingLayout2 = existingLayout2Candidate
    && (!existingLayout1 || getMediaIdentity(existingLayout2Candidate) !== getMediaIdentity(existingLayout1))
    ? existingLayout2Candidate
    : null;
  const usedIdentities = new Set(
    [existingLayout1, existingLayout2]
      .filter((url): url is string => Boolean(url))
      .map(getMediaIdentity),
  );
  const seenImageIdentities = new Set(usedIdentities);
  const freshImages = resolution.images.filter((image) => {
    const imageUrl = getSafeMediaUrl(image.src);
    if (!imageUrl || !isLikelyEditorialImageUrl(imageUrl)) return false;

    const identity = getMediaIdentity(imageUrl);
    if (seenImageIdentities.has(identity)) return false;
    seenImageIdentities.add(identity);
    return true;
  });
  const resolvedVideoUrl = getCanonicalYouTubeWatchUrl(resolution.video?.videoUrl);
  const remainingImages = [...freshImages];
  const layout1 = existingLayout1 || resolvedVideoUrl || remainingImages.shift()?.src || null;

  if (layout1) usedIdentities.add(getMediaIdentity(layout1));

  const layout2 = existingLayout2 || (needsSecondImage
    ? remainingImages.find((image) => {
        const imageUrl = getSafeMediaUrl(image.src);
        return Boolean(imageUrl && !usedIdentities.has(getMediaIdentity(imageUrl)));
      })?.src || null
    : null);

  return { layout1, layout2 };
}

export async function resolveRelatedNewsMedia({
  title,
  excerpt,
  excludedUrls,
  needsSecondImage,
}: {
  title: string;
  excerpt?: string | null;
  excludedUrls: Array<string | null | undefined>;
  needsSecondImage: boolean;
}): Promise<RelatedNewsMediaResolution> {
  const video = await findFreshYouTubeMedia({ title, excerpt });
  const imageLimit = video ? (needsSecondImage ? 1 : 0) : (needsSecondImage ? 2 : 1);

  if (imageLimit === 0) return { video, images: [] };

  const imageExclusions = [...excludedUrls, video?.thumbnailUrl];
  const googleImages = await findGoogleNewsImages({
    title,
    excerpt,
    excludedUrls: imageExclusions,
  });
  const remainingImageSlots = Math.max(imageLimit - googleImages.length, 0);
  const wikimediaImages = remainingImageSlots > 0
    ? await findRecentNewsImages({
        title,
        excerpt,
        excludedUrls: [...imageExclusions, ...googleImages.map((image) => image.src)],
      })
    : [];

  return {
    video,
    images: [...googleImages, ...wikimediaImages].slice(0, imageLimit),
  };
}
