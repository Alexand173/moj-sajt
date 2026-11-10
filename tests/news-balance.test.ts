import { afterEach, describe, expect, it } from 'vitest';
import {
  balanceFeedMix,
  DEFAULT_NEWS_DAILY_PER_REGION,
  getNewsDailyPerRegion,
  remainingQuotaByRegion,
  takeWithinQuota,
} from '@/lib/news-balance';

afterEach(() => {
  delete process.env.NEWS_DAILY_PER_REGION;
});

/**
 * The measured problem: over 14 days US received 399 LATEST and 384 OFFICIAL
 * rows, WORLD received 129 and 0, UK received 7 and 123. These rules are what
 * keep one region or one category from consuming the day.
 */
describe('daily per-region allowance', () => {
  it('gives every region the same starting allowance', () => {
    const remaining = remainingQuotaByRegion({}, ['us', 'uk', 'world'], 10);

    expect(remaining).toEqual({ us: 10, uk: 10, world: 10 });
  });

  it('measures what is left from what the region already received', () => {
    const remaining = remainingQuotaByRegion({ us: 4, 'UK': 10, world: 15 }, ['us', 'uk', 'world'], 10);

    expect(remaining).toEqual({ us: 6, uk: 0, world: 0 });
  });

  it('drops only the rows that would exceed the region budget', () => {
    const articles = [
      { region: 'us' }, { region: 'us' }, { region: 'us' },
      { region: 'uk' }, { region: 'uk' },
    ];

    const { kept, dropped } = takeWithinQuota(articles, (article) => article.region, { us: 2, uk: 5 });

    expect(kept).toHaveLength(4);
    expect(dropped).toEqual({ us: 1 });
    expect(kept.filter((article) => article.region === 'us')).toHaveLength(2);
  });

  it('treats a region with no allowance as full rather than unlimited', () => {
    const { kept, dropped } = takeWithinQuota([{ region: 'world' }], (item) => item.region, {});

    expect(kept).toHaveLength(0);
    expect(dropped).toEqual({ world: 1 });
  });

  it('reads the target from the environment and clamps nonsense', () => {
    expect(getNewsDailyPerRegion()).toBe(DEFAULT_NEWS_DAILY_PER_REGION);

    process.env.NEWS_DAILY_PER_REGION = '24';
    expect(getNewsDailyPerRegion()).toBe(24);

    process.env.NEWS_DAILY_PER_REGION = '9999';
    expect(getNewsDailyPerRegion()).toBe(40);

    process.env.NEWS_DAILY_PER_REGION = 'not-a-number';
    expect(getNewsDailyPerRegion()).toBe(DEFAULT_NEWS_DAILY_PER_REGION);
  });
});

describe('region page mix', () => {
  const fill = (length: number, label: string) =>
    Array.from({ length }, (_, index) => `${label}-${index}`);

  it('leaves a healthy pair untouched', () => {
    const mix = balanceFeedMix(Array.from({ length: 50 }, (_, i) => `l${i}`), Array.from({ length: 40 }, (_, i) => `o${i}`));

    expect(mix.latest).toHaveLength(50);
    expect(mix.official).toHaveLength(40);
  });

  it('trims the larger stream to twice the smaller', () => {
    const mix = balanceFeedMix(fill(50, 'latest'), fill(10, 'official'));

    expect(mix.latest).toHaveLength(20);
    expect(mix.official).toHaveLength(10);
  });

  it('trims the other way round too', () => {
    const mix = balanceFeedMix(fill(4, 'latest'), fill(50, 'official'));

    expect(mix.latest).toHaveLength(4);
    expect(mix.official).toHaveLength(8);
  });

  it('keeps the healthy stream when the other side is empty', () => {
    const mix = balanceFeedMix(fill(30, 'latest'), []);

    expect(mix.latest).toHaveLength(30);
    expect(mix.official).toHaveLength(0);
  });

  it('never exceeds the page cap', () => {
    const mix = balanceFeedMix(fill(80, 'latest'), fill(80, 'official'), 50);

    expect(mix.latest).toHaveLength(50);
    expect(mix.official).toHaveLength(50);
  });
});
