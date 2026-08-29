import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRelatedNewsMedia } from '@/lib/news-media';

const recentTimestamp = new Date(Date.now() - 60_000).toISOString();
const originalFetch = globalThis.fetch;

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function setYouTubeAndWikimediaResponses({
  youtubeItems,
  youtubeDetails,
  wikimediaPages = {},
}: {
  youtubeItems: Array<{ videoId: string }>;
  youtubeDetails: Array<Record<string, unknown>>;
  wikimediaPages?: Record<string, unknown>;
}) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const requestUrl = String(input);

    if (requestUrl.includes('/youtube/v3/search')) {
      return jsonResponse({
        items: youtubeItems.map(({ videoId }) => ({ id: { videoId } })),
      });
    }

    if (requestUrl.includes('/youtube/v3/videos')) {
      return jsonResponse({ items: youtubeDetails });
    }

    if (requestUrl.includes('commons.wikimedia.org/w/api.php')) {
      return jsonResponse({ query: { pages: wikimediaPages } });
    }

    throw new Error(`Unexpected media request: ${requestUrl}`);
  }) as typeof fetch;
}

function imagePage(title: string, src: string, artist = 'Test photographer') {
  return {
    title: `File:${title}`,
    imageinfo: [{
      thumburl: src,
      mime: 'image/jpeg',
      width: 1600,
      height: 900,
      timestamp: recentTimestamp,
      extmetadata: { Artist: { value: artist } },
    }],
  };
}

describe('related news media resolver', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-youtube-key';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('selects the highest-view eligible recent YouTube result', async () => {
    setYouTubeAndWikimediaResponses({
      youtubeItems: [
        { videoId: 'AAAAAAAAAAA' },
        { videoId: 'BBBBBBBBBBB' },
      ],
      youtubeDetails: [
        {
          id: 'AAAAAAAAAAA',
          snippet: {
            title: 'Harbor Lights Ensemble live session',
            channelTitle: 'Harbor Lights',
            publishedAt: recentTimestamp,
          },
          statistics: { viewCount: '100' },
        },
        {
          id: 'BBBBBBBBBBB',
          snippet: {
            title: 'Harbor Lights Ensemble festival performance',
            channelTitle: 'Harbor Lights Official',
            publishedAt: recentTimestamp,
          },
          statistics: { viewCount: '900' },
        },
      ],
    });

    const media = await resolveRelatedNewsMedia({
      title: 'Harbor Lights Ensemble announces a new album',
      excludedUrls: [],
      needsSecondImage: false,
    });

    expect(media.video?.videoId).toBe('BBBBBBBBBBB');
    expect(media.video?.viewCount).toBe(900);
    expect(media.images).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to two distinct subject images when YouTube has no result', async () => {
    const headlineImage = 'https://cdn.example.com/harbor-headline.jpg';

    setYouTubeAndWikimediaResponses({
      youtubeItems: [],
      youtubeDetails: [],
      wikimediaPages: {
        first: imagePage('Harbor Lights Ensemble on stage.jpg', headlineImage),
        second: imagePage('Harbor Lights Ensemble live performance.jpg', 'https://upload.wikimedia.org/harbor-live.jpg'),
        third: imagePage('Harbor Lights Ensemble backstage.jpg', 'https://upload.wikimedia.org/harbor-backstage.jpg'),
        logo: imagePage('Harbor Lights Ensemble logo.jpg', 'https://upload.wikimedia.org/harbor-logo.jpg'),
      },
    });

    const media = await resolveRelatedNewsMedia({
      title: 'Harbor Lights Ensemble announces a new album',
      excludedUrls: [headlineImage],
      needsSecondImage: true,
    });

    expect(media.video).toBeNull();
    expect(media.images).toHaveLength(2);
    expect(media.images.map((image) => image.src)).toEqual([
      'https://upload.wikimedia.org/harbor-live.jpg',
      'https://upload.wikimedia.org/harbor-backstage.jpg',
    ]);
    expect(new Set(media.images.map((image) => image.src)).size).toBe(2);
    expect(media.images.every((image) => image.src !== headlineImage)).toBe(true);
  });

  it('keeps the second image when video is selected and excludes its thumbnail', async () => {
    const videoId = 'CCCCCCCCCCC';
    const videoThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    setYouTubeAndWikimediaResponses({
      youtubeItems: [{ videoId }],
      youtubeDetails: [{
        id: videoId,
        snippet: {
          title: 'Harbor Lights Ensemble interview',
          channelTitle: 'Harbor Lights Official',
          publishedAt: recentTimestamp,
        },
        statistics: { viewCount: '1200' },
      }],
      wikimediaPages: {
        thumbnail: imagePage('Harbor Lights Ensemble thumbnail.jpg', videoThumbnail),
        second: imagePage('Harbor Lights Ensemble portrait.jpg', 'https://upload.wikimedia.org/harbor-portrait.jpg'),
      },
    });

    const media = await resolveRelatedNewsMedia({
      title: 'Harbor Lights Ensemble announces a new album',
      excludedUrls: ['https://cdn.example.com/harbor-headline.jpg'],
      needsSecondImage: true,
    });

    expect(media.video?.videoId).toBe(videoId);
    expect(media.images).toHaveLength(1);
    expect(media.images[0]?.src).toBe('https://upload.wikimedia.org/harbor-portrait.jpg');
    expect(media.images[0]?.src).not.toBe(videoThumbnail);
  });
});
