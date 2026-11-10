import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findExactTitleMatch,
  lookupArticleByTitle,
  normalizeArticleTitle,
} from '@/lib/news-url-recovery';

/**
 * The rule that decides whether a URL-less row gets its source back.
 *
 * It has to be strict, because the failure mode is a link to the wrong story
 * with the wrong publisher named in the brief. It also has to be insensitive to
 * typography, because the same headline arrives with a straight apostrophe from
 * one feed and a curly one from a page, and a per-character comparison lost
 * those matches.
 */

describe('title normalisation', () => {
  it('treats typographic variants of one headline as the same title', () => {
    const fromFeed = "Guns N' Roses add 2027 stadium dates";
    const fromPage = 'Guns N\u2019 Roses add 2027 stadium dates';

    expect(normalizeArticleTitle(fromFeed)).toBe(normalizeArticleTitle(fromPage));
    expect(normalizeArticleTitle('Eminem \u2014 new album')).toBe(normalizeArticleTitle('Eminem - new album'));
    expect(normalizeArticleTitle('  Charli   XCX:  tour  ')).toBe('charli xcx tour');
  });

  it('does not collapse two different headlines', () => {
    expect(normalizeArticleTitle('Eminem announces tour')).not.toBe(normalizeArticleTitle('Eminem cancels tour'));
    expect(normalizeArticleTitle('Eminem announces tour')).not.toBe(normalizeArticleTitle('Eminem announces tour dates'));
    expect(normalizeArticleTitle('')).toBe('');
    expect(normalizeArticleTitle('!!! —')).toBe('');
  });
});

describe('exact title match', () => {
  const candidates = [
    { title: 'Eminem announces 2027 tour', url: 'https://example.com/eminem-tour' },
    { title: 'Eminem announces 2027 tour dates', url: 'https://example.com/eminem-tour-dates' },
    { title: "Guns N\u2019 Roses reunite", url: 'https://example.com/gnr' },
  ];

  it('picks the article with the same headline, not the near one', () => {
    expect(findExactTitleMatch(candidates, 'Eminem announces 2027 tour')?.url).toBe('https://example.com/eminem-tour');
    expect(findExactTitleMatch(candidates, "Guns N' Roses reunite")?.url).toBe('https://example.com/gnr');
  });

  it('returns null rather than the closest result', () => {
    expect(findExactTitleMatch(candidates, 'Eminem announces 2027 tour tickets')).toBeNull();
    expect(findExactTitleMatch(candidates, '')).toBeNull();
    expect(findExactTitleMatch(null, 'Eminem announces 2027 tour')).toBeNull();
  });
});

describe('NewsAPI title lookup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to call NewsAPI without a key', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const lookup = await lookupArticleByTitle({ title: 'Anything', apiKey: '' });

    expect(lookup.error).toBe('missing-key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks for the headline in the title only, and returns the matching article', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ok',
      articles: [
        { title: 'A different story', url: 'https://example.com/other' },
        { title: 'Teddy Swims announces 2027 arena tour', url: 'https://example.com/teddy', source: { name: 'Billboard' } },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchSpy);

    const lookup = await lookupArticleByTitle({ title: 'Teddy Swims announces 2027 arena tour', apiKey: 'test-key' });

    const requested = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(requested).toContain('searchIn=title');
    expect(requested).toContain(encodeURIComponent('"Teddy Swims announces 2027 arena tour"'));
    expect(lookup.match?.url).toBe('https://example.com/teddy');
  });

  it('reports a rate limit instead of treating it as a miss', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'error',
      code: 'rateLimited',
      message: 'You have made too many requests recently.',
    }), { status: 429 })));

    const lookup = await lookupArticleByTitle({ title: 'Anything', apiKey: 'test-key' });

    expect(lookup.error).toBe('rate-limited');
    expect(lookup.match).toBeNull();
  });

  it('never throws when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND newsapi.org')));

    const lookup = await lookupArticleByTitle({ title: 'Anything', apiKey: 'test-key' });

    expect(lookup.error).toBe('network');
    expect(lookup.match).toBeNull();
  });
});
