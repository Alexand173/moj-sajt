// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsEditorialView from '@/components/NewsEditorialView';
import type { NewsEditorialItem } from '@/components/NewsEditorialView';

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

vi.mock('@/components/AddPostTrigger', () => ({ default: () => null }));
vi.mock('@/components/AddCommentTrigger', () => ({ default: () => null }));
vi.mock('@/components/AddAlbumTrigger', () => ({ default: () => null }));
vi.mock('@/components/AlbumGallery', () => ({ default: () => null }));

const readyBrief = {
  id: 'official-1',
  status: 'ready',
  title: 'Jay-Z brings his Jay-Z 30 concert series to a close in Los Angeles',
  sourceName: 'variety.com',
  sourceUrl: 'https://variety.com/story',
  publishedAt: '2026-10-25T00:00:00.000Z',
  articleContent: 'Jay-Z closed out his Hollywood Bowl run with a guest-heavy finale.\n\nDr. Dre and Snoop Dogg joined the closing stretch of the set.',
  similarityScore: 0.14,
  wordCount: 26,
};

const officialNews: NewsEditorialItem[] = [
  {
    id: 'official-1',
    title: 'Jay-Z brings his Jay-Z 30 concert series to a close in Los Angeles',
    category: 'OFFICIAL',
    created_at: '2026-10-25T00:00:00.000Z',
    url: 'https://variety.com/story',
    ai_generated: true,
    ai_status: 'generated',
  },
];

const latestNews: NewsEditorialItem[] = [
  { id: 'latest-1', title: 'Latest story one', category: 'LATEST', created_at: '2026-10-24T00:00:00.000Z' },
  { id: 'latest-2', title: 'Latest story two', category: 'LATEST', created_at: '2026-10-24T00:00:00.000Z' },
];

function mockViewport(isDesktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isDesktop && query.includes('min-width: 1024px'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderView({ initialOfficialId = null }: { initialOfficialId?: string | null } = {}) {
  return render(
    <NewsEditorialView
      region="us"
      initialOfficialId={initialOfficialId}
      latestNews={latestNews}
      communityNews={[]}
      officialNews={officialNews}
      mostReadNews={[]}
      storiesByMass={[]}
      communityPosts={[]}
      discussions={[]}
      concertAlbums={[]}
    />,
  );
}

function openOfficialStory() {
  fireEvent.click(screen.getByRole('button', { name: /Jay-Z brings his Jay-Z 30/ }));
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  routerReplace.mockClear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => readyBrief })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NewsEditorialView official brief', () => {
  it('replaces the whole middle column with the brief on desktop', async () => {
    mockViewport(true);
    renderView();

    expect(screen.getByRole('heading', { name: 'Latest news' })).toBeTruthy();

    openOfficialStory();

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Latest news' })).toBeNull();
    });

    expect(screen.queryByRole('heading', { name: 'Latest story one' })).toBeNull();
    expect(await screen.findByRole('heading', { level: 3, name: /Jay-Z brings his Jay-Z 30/ })).toBeTruthy();
    expect(await screen.findByText(/guest-heavy finale/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Back to the feed/ })).toBeTruthy();
    expect(document.querySelector('#latest-news-heading')).toBeNull();
    // The open brief is mirrored into the URL so analytics records a page view.
    expect(routerReplace).toHaveBeenCalledWith('/news/us?official=official-1', { scroll: false });
  });

  it('returns the latest feed to the middle column when the brief is closed on desktop', async () => {
    mockViewport(true);
    renderView();

    openOfficialStory();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Latest news' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Back to the feed/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Latest news' })).toBeTruthy();
    });
    expect(screen.queryByRole('heading', { level: 3, name: /Jay-Z brings his Jay-Z 30/ })).toBeNull();
    expect(routerReplace).toHaveBeenLastCalledWith('/news/us', { scroll: false });
  });

  it('opens the brief on first render when the url names it', async () => {
    mockViewport(true);
    renderView({ initialOfficialId: 'official-1' });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Latest news' })).toBeNull();
    });

    expect(screen.getByRole('button', { name: /Back to the feed/ })).toBeTruthy();
    expect(await screen.findByText(/guest-heavy finale/)).toBeTruthy();
    // A deep link must not rewrite the url again.
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('opens only an inline brief under the tapped headline on mobile and keeps the page in place', async () => {
    mockViewport(false);
    renderView();

    openOfficialStory();

    await waitFor(() => {
      expect(document.querySelector('#official-brief-official-1-article')).toBeTruthy();
    });

    expect(await screen.findByText(/guest-heavy finale/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Latest news' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Latest story one' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Back to the feed/ })).toBeNull();
  });
});
